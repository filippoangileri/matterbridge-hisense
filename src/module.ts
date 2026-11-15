/**
 * matterbridge-hisense: espone i climatizzatori Hisense (modulo Wi-Fi AEH-W4B1, cloud Ayla)
 * come dispositivi Matter tramite Matterbridge.
 */
import {
  bridgedNode,
  MatterbridgeDynamicPlatform,
  MatterbridgeEndpoint,
  type PlatformConfig,
  type PlatformMatterbridge,
  powerSource,
  roomAirConditioner,
  thermostat,
} from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';

import { AylaClient, type AylaDevice, AylaLoginError, type AylaProperties } from './ayla.js';
import {
  asInt,
  celsiusToDevice,
  deviceToCelsius,
  FanMode,
  fromFanMode,
  fromFanPercent,
  fromSystemMode,
  SETPOINT_MAX_C,
  SETPOINT_MIN_C,
  SystemMode,
  toFanControl,
  toSystemMode,
  WorkMode,
} from './hisense.js';

const THERMOSTAT = 'thermostat';
const ON_OFF = 'onOff';
const FAN_CONTROL = 'fanControl';
const BRIDGED_INFO = 'bridgedDeviceBasicInformation';

/** Per quanto ignorare i valori letti dal cloud dopo una nostra scrittura (il cloud può essere in ritardo). */
const WRITE_GRACE_MS = 15_000;

export type HisensePlatformConfig = PlatformConfig & {
  email: string;
  password: string;
  app: string;
  deviceType: 'thermostat' | 'airConditioner';
  namePrefix: string;
  pollInterval: number;
  whiteList: string[];
  blackList: string[];
  debug: boolean;
  unregisterOnShutdown: boolean;
};

interface HisenseDevice {
  dsn: string;
  name: string;
  endpoint: MatterbridgeEndpoint;
  props: AylaProperties;
  online: boolean;
  /** nome proprietà Ayla → timestamp dell'ultima scrittura */
  writtenAt: Map<string, number>;
  /** coda delle scritture: una alla volta per dispositivo */
  queue: Promise<void>;
  refreshTimer?: NodeJS.Timeout;
}

export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): HisensePlatform {
  return new HisensePlatform(matterbridge, log, config as HisensePlatformConfig);
}

export class HisensePlatform extends MatterbridgeDynamicPlatform {
  declare config: HisensePlatformConfig;
  private client?: AylaClient;
  private readonly devices = new Map<string, HisenseDevice>();
  private pollTimer?: NodeJS.Timeout;
  private polling = false;

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: HisensePlatformConfig) {
    super(matterbridge, log, config);
    if (typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.11.0')) {
      throw new Error(`Questo plugin richiede Matterbridge >= 3.11.0 (installata: ${this.matterbridge.matterbridgeVersion}).`);
    }
    this.log.info('Inizializzazione matterbridge-hisense');
  }

  private get isAirConditioner(): boolean {
    return this.config.deviceType === 'airConditioner';
  }

  private get apiCelsius(): boolean {
    return this.client?.celsius ?? true;
  }

  // ------------------------------------------------------------------ ciclo di vita

  override async onStart(reason?: string): Promise<void> {
    this.log.info(`onStart: ${reason ?? ''}`);
    await this.ready;
    await this.clearSelect();

    const { email, password } = this.config;
    if (!email || !password) {
      this.log.error('Configura email e password dell\'app Hisense (Hi-Smart AC) nelle impostazioni del plugin.');
      return;
    }
    this.client = new AylaClient(email, password, this.config.app || 'oem-eu');

    let devices: AylaDevice[];
    try {
      devices = await this.client.devices();
    } catch (err) {
      if (err instanceof AylaLoginError) {
        this.log.error(`Login Hisense/Ayla rifiutato: ${err.message}. Correggi email/password/app e riavvia: non ritento per non bloccare l'account.`);
      } else {
        this.log.error(`Impossibile leggere i dispositivi dal cloud Ayla: ${(err as Error).message}`);
      }
      return;
    }

    for (const dev of devices) {
      if (!dev.dsn) continue;
      const label = dev.product_name || dev.dsn;
      this.setSelectDevice(dev.dsn, label);
      if (!this.validateDevice([label, dev.dsn])) continue;
      try {
        await this.addDevice(dev);
      } catch (err) {
        this.log.error(`Errore nella creazione del dispositivo ${label}: ${(err as Error).message}`);
      }
    }
    this.log.info(`Registrati ${this.devices.size} climatizzatori`);
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.info('onConfigure: lettura iniziale dello stato');
    await this.poll();
    const seconds = Math.max(15, Number(this.config.pollInterval) || 30);
    this.pollTimer = setInterval(() => void this.poll(), seconds * 1000);
  }

  override async onShutdown(reason?: string): Promise<void> {
    this.log.info(`onShutdown: ${reason ?? ''}`);
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const dev of this.devices.values()) if (dev.refreshTimer) clearTimeout(dev.refreshTimer);
    await super.onShutdown(reason);
    if (this.config.unregisterOnShutdown) await this.unregisterAllDevices();
  }

  // ------------------------------------------------------------------ creazione dispositivi

  private async addDevice(dev: AylaDevice): Promise<void> {
    const client = this.client as AylaClient;
    const props = await client.properties(dev.dsn);
    const name = `${this.config.namePrefix ?? 'Condizionatore '}${dev.product_name || dev.dsn}`.trim();
    const model = String(dev.model ?? dev.oem_model ?? 'AEH-W4B1');

    const powerOn = asInt(props.t_power, 0) === 1;
    const room = deviceToCelsius(props.f_temp_in, client.celsius) ?? 22;
    const setpoint = clampSetpoint(deviceToCelsius(props.t_temp, client.celsius) ?? 24);

    const types = this.isAirConditioner ? [roomAirConditioner, bridgedNode, powerSource] : [thermostat, bridgedNode, powerSource];
    const endpoint = new MatterbridgeEndpoint(types as [typeof thermostat, ...(typeof thermostat)[]], { id: dev.dsn }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer(
        name,
        dev.dsn,
        this.matterbridge.aggregatorVendorId,
        'Hisense',
        `Hisense ${model}`,
        1,
        String(dev.sw_version ?? '1.0.0').slice(0, 64),
      )
      .createDefaultPowerSourceWiredClusterServer();

    if (this.isAirConditioner) endpoint.createDeadFrontOnOffClusterServer(powerOn);

    // Un solo setpoint reale: riscaldamento e raffreddamento vengono tenuti uguali (deadband 0).
    endpoint
      .createDefaultThermostatClusterServer(room, setpoint, setpoint, 0, SETPOINT_MIN_C, SETPOINT_MAX_C, SETPOINT_MIN_C, SETPOINT_MAX_C)
      .createDefaultThermostatUserInterfaceConfigurationClusterServer();

    if (this.isAirConditioner) {
      const [fanMode, percent] = toFanControl(asInt(props.t_fan_speed, 0));
      endpoint.createDefaultFanControlClusterServer(fanMode, undefined, percent, percent);
    }
    endpoint.addRequiredClusterServers();

    const device: HisenseDevice = {
      dsn: dev.dsn,
      name,
      endpoint,
      props,
      online: dev.connection_status === 'Online',
      writtenAt: new Map(),
      queue: Promise.resolve(),
    };
    this.subscribe(device);
    await this.registerDevice(endpoint);
    this.devices.set(dev.dsn, device);
    this.log.info(`Aggiunto "${name}" (${dev.dsn}, ${this.isAirConditioner ? 'condizionatore' : 'termostato'})`);
  }

  /** Comandi da Alexa/controller Matter → cloud Ayla. */
  private subscribe(device: HisenseDevice): void {
    const { endpoint } = device;
    const fromController = (context: { fabric?: unknown } | undefined) => context?.fabric !== undefined;

    endpoint.subscribeAttribute(
      THERMOSTAT,
      'systemMode',
      (value: number, _old: number, context) => {
        if (!fromController(context)) return;
        const workMode = fromSystemMode(value);
        this.log.info(`[${device.name}] systemMode → ${value}`);
        if (workMode === undefined) {
          this.write(device, [['t_power', 0]]);
          if (this.isAirConditioner) void endpoint.updateAttribute(ON_OFF, 'onOff', false, this.log);
        } else {
          this.write(device, [
            ['t_work_mode', workMode],
            ['t_power', 1],
          ]);
          if (this.isAirConditioner) void endpoint.updateAttribute(ON_OFF, 'onOff', true, this.log);
        }
      },
      this.log,
    );

    const onSetpoint = (attribute: string, mirror: string) => {
      endpoint.subscribeAttribute(
        THERMOSTAT,
        attribute,
        (value: number, _old: number, context) => {
          if (!fromController(context) || typeof value !== 'number') return;
          const celsius = clampSetpoint(value / 100);
          this.log.info(`[${device.name}] ${attribute} → ${celsius} °C`);
          this.write(device, [['t_temp', celsiusToDevice(celsius, this.apiCelsius)]]);
          // Il climatizzatore ha un solo setpoint: allinea l'altro.
          void endpoint.updateAttribute(THERMOSTAT, mirror, Math.round(celsius * 100), this.log);
        },
        this.log,
      );
    };
    onSetpoint('occupiedHeatingSetpoint', 'occupiedCoolingSetpoint');
    onSetpoint('occupiedCoolingSetpoint', 'occupiedHeatingSetpoint');

    if (!this.isAirConditioner) return;

    endpoint.subscribeAttribute(
      ON_OFF,
      'onOff',
      (value: boolean, _old: boolean, context) => {
        if (!fromController(context)) return;
        this.log.info(`[${device.name}] onOff → ${value}`);
        this.write(device, [['t_power', value ? 1 : 0]]);
        const mode = toSystemMode(value, asInt(device.props.t_work_mode, WorkMode.COOL));
        void this.setSystemMode(device, mode);
      },
      this.log,
    );

    endpoint.subscribeAttribute(
      FAN_CONTROL,
      'fanMode',
      (value: number, _old: number, context) => {
        if (!fromController(context)) return;
        const speed = fromFanMode(value);
        this.log.info(`[${device.name}] fanMode → ${value}`);
        if (speed !== undefined) this.write(device, [['t_fan_speed', speed]]);
      },
      this.log,
    );

    endpoint.subscribeAttribute(
      FAN_CONTROL,
      'percentSetting',
      (value: number | null, _old: number | null, context) => {
        if (!fromController(context) || value === null) return;
        const speed = fromFanPercent(value);
        this.log.info(`[${device.name}] percentSetting → ${value}`);
        if (speed !== undefined) this.write(device, [['t_fan_speed', speed]]);
      },
      this.log,
    );
  }

  // ------------------------------------------------------------------ scrittura

  /** Accoda le scritture sul cloud (una alla volta per dispositivo) e programma una rilettura. */
  private write(device: HisenseDevice, changes: [string, number][]): void {
    const client = this.client;
    if (!client) return;
    for (const [name, value] of changes) {
      device.props[name] = value;
      device.writtenAt.set(name, Date.now());
    }
    device.queue = device.queue.then(async () => {
      for (const [name, value] of changes) {
        try {
          await client.setProperty(device.dsn, name, value);
          this.log.debug(`[${device.name}] ${name} = ${value}`);
        } catch (err) {
          this.log.error(`[${device.name}] scrittura ${name}=${value} fallita: ${(err as Error).message}`);
        }
      }
    });
    if (device.refreshTimer) clearTimeout(device.refreshTimer);
    device.refreshTimer = setTimeout(() => void this.refreshDevice(device, true), 5_000);
  }

  // ------------------------------------------------------------------ lettura

  private async poll(): Promise<void> {
    const client = this.client;
    if (!client || this.polling || this.devices.size === 0) return;
    this.polling = true;
    try {
      const status = new Map((await client.devices()).map((d) => [d.dsn, d.connection_status === 'Online']));
      for (const device of this.devices.values()) {
        device.online = status.get(device.dsn) ?? false;
        await this.refreshDevice(device, false);
      }
    } catch (err) {
      this.log.warn(`Aggiornamento dal cloud fallito: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async refreshDevice(device: HisenseDevice, afterWrite: boolean): Promise<void> {
    const client = this.client;
    if (!client) return;
    await device.queue;
    const { endpoint } = device;
    try {
      const fresh = await client.properties(device.dsn);
      const now = Date.now();
      for (const [name, value] of Object.entries(fresh)) {
        const written = device.writtenAt.get(name);
        // Subito dopo una scrittura il cloud può restituire ancora il valore vecchio.
        if (!afterWrite && written !== undefined && now - written < WRITE_GRACE_MS) continue;
        device.props[name] = value;
      }
    } catch (err) {
      this.log.warn(`[${device.name}] lettura stato fallita: ${(err as Error).message}`);
      return;
    }

    const p = device.props;
    const powerOn = asInt(p.t_power, 0) === 1;
    const workMode = asInt(p.t_work_mode, WorkMode.COOL);
    const setpoint = deviceToCelsius(p.t_temp, client.celsius);
    const room = deviceToCelsius(p.f_temp_in, client.celsius);

    await endpoint.updateAttribute(BRIDGED_INFO, 'reachable', device.online, this.log);
    if (room !== undefined) await endpoint.updateAttribute(THERMOSTAT, 'localTemperature', Math.round(room * 100), this.log);
    if (setpoint !== undefined) {
      const value = Math.round(clampSetpoint(setpoint) * 100);
      await endpoint.updateAttribute(THERMOSTAT, 'occupiedHeatingSetpoint', value, this.log);
      await endpoint.updateAttribute(THERMOSTAT, 'occupiedCoolingSetpoint', value, this.log);
    }
    await this.setSystemMode(device, toSystemMode(powerOn, workMode));
    await this.setRunningState(device, powerOn, workMode);

    if (this.isAirConditioner) {
      await endpoint.updateAttribute(ON_OFF, 'onOff', powerOn, this.log);
      const [fanMode, percent] = toFanControl(asInt(p.t_fan_speed, 0));
      await endpoint.updateAttribute(FAN_CONTROL, 'fanMode', fanMode, this.log);
      if (fanMode !== FanMode.Auto) await endpoint.updateAttribute(FAN_CONTROL, 'percentSetting', percent, this.log);
      await endpoint.updateAttribute(FAN_CONTROL, 'percentCurrent', powerOn ? percent : 0, this.log);
    }
  }

  /** Imposta systemMode; se il controller non accetta Dry/FanOnly ripiega su Auto. */
  private async setSystemMode(device: HisenseDevice, mode: number): Promise<void> {
    const ok = await device.endpoint.updateAttribute(THERMOSTAT, 'systemMode', mode, this.log).catch(() => false);
    const current = device.endpoint.getAttribute(THERMOSTAT, 'systemMode', this.log);
    if (!ok && current !== mode && (mode === SystemMode.Dry || mode === SystemMode.FanOnly)) {
      await device.endpoint.updateAttribute(THERMOSTAT, 'systemMode', SystemMode.Auto, this.log).catch(() => false);
    }
  }

  private async setRunningState(device: HisenseDevice, powerOn: boolean, workMode: number): Promise<void> {
    const state = {
      heat: powerOn && workMode === WorkMode.HEAT,
      cool: powerOn && (workMode === WorkMode.COOL || workMode === WorkMode.DRY),
      fan: powerOn,
      heatStage2: false,
      coolStage2: false,
      fanStage2: false,
      fanStage3: false,
    };
    await device.endpoint.updateAttribute(THERMOSTAT, 'thermostatRunningState', state, this.log).catch(() => false);
  }
}

function clampSetpoint(celsius: number): number {
  return Math.min(SETPOINT_MAX_C, Math.max(SETPOINT_MIN_C, celsius));
}

/**
 * Mappature tra le proprietà Ayla dei climatizzatori Hisense (AEH-W4B1) e Matter.
 * Nomi e valori verificati sui dispositivi reali (vedi hisense-alexa).
 */

/** t_work_mode */
export const WorkMode = { FAN: 0, HEAT: 1, COOL: 2, DRY: 3, AUTO: 4 } as const;

/** t_fan_speed */
export const FanSpeed = { AUTO: 0, LOWER: 5, LOW: 6, MEDIUM: 7, HIGH: 8, HIGHER: 9 } as const;

/** Thermostat.SystemMode (Matter) */
export const SystemMode = { Off: 0, Auto: 1, Cool: 3, Heat: 4, FanOnly: 7, Dry: 8 } as const;

/** FanControl.FanMode (Matter) */
export const FanMode = { Off: 0, Low: 1, Medium: 2, High: 3, On: 4, Auto: 5, Smart: 6 } as const;

/** Range del setpoint accettato dai climatizzatori, in °C. */
export const SETPOINT_MIN_C = 16;
export const SETPOINT_MAX_C = 32;

export function asInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Converte una temperatura letta dal cloud in °C.
 * Le API sono in °F o °C a seconda dell'app, ma alcuni firmware riportano valori nell'altra
 * unità (es. t_temp=32 in ventilazione): soglia di plausibilità 45 °F / 50 °C.
 */
export function deviceToCelsius(value: unknown, apiCelsius: boolean): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const v = Number(value);
  if (!Number.isFinite(v)) return undefined;
  if (apiCelsius) return v > 50 ? ((v - 32) * 5) / 9 : v;
  return v < 45 ? v : ((v - 32) * 5) / 9;
}

/** Converte °C nel valore intero da scrivere in t_temp. */
export function celsiusToDevice(celsius: number, apiCelsius: boolean): number {
  const c = Math.min(SETPOINT_MAX_C, Math.max(SETPOINT_MIN_C, celsius));
  return Math.round(apiCelsius ? c : (c * 9) / 5 + 32);
}

/** Stato di potenza + modalità del climatizzatore → SystemMode Matter. */
export function toSystemMode(powerOn: boolean, workMode: number): number {
  if (!powerOn) return SystemMode.Off;
  switch (workMode) {
    case WorkMode.HEAT:
      return SystemMode.Heat;
    case WorkMode.COOL:
      return SystemMode.Cool;
    case WorkMode.DRY:
      return SystemMode.Dry;
    case WorkMode.FAN:
      return SystemMode.FanOnly;
    default:
      return SystemMode.Auto;
  }
}

/** SystemMode Matter → t_work_mode (undefined = spento / non gestito). */
export function fromSystemMode(mode: number): number | undefined {
  switch (mode) {
    case SystemMode.Heat:
      return WorkMode.HEAT;
    case SystemMode.Cool:
      return WorkMode.COOL;
    case SystemMode.Auto:
      return WorkMode.AUTO;
    case SystemMode.Dry:
      return WorkMode.DRY;
    case SystemMode.FanOnly:
      return WorkMode.FAN;
    default:
      return undefined;
  }
}

/** t_fan_speed → [FanMode, percentuale] Matter. */
export function toFanControl(speed: number): [number, number] {
  switch (speed) {
    case FanSpeed.LOWER:
      return [FanMode.Low, 20];
    case FanSpeed.LOW:
      return [FanMode.Low, 40];
    case FanSpeed.MEDIUM:
      return [FanMode.Medium, 60];
    case FanSpeed.HIGH:
      return [FanMode.High, 80];
    case FanSpeed.HIGHER:
      return [FanMode.High, 100];
    default:
      return [FanMode.Auto, 0];
  }
}

/** FanMode Matter → t_fan_speed (undefined = Off, da ignorare). */
export function fromFanMode(mode: number): number | undefined {
  switch (mode) {
    case FanMode.Low:
      return FanSpeed.LOW;
    case FanMode.Medium:
    case FanMode.On:
      return FanSpeed.MEDIUM;
    case FanMode.High:
      return FanSpeed.HIGH;
    case FanMode.Auto:
    case FanMode.Smart:
      return FanSpeed.AUTO;
    default:
      return undefined;
  }
}

/** Percentuale ventola Matter (1-100) → t_fan_speed. */
export function fromFanPercent(percent: number): number | undefined {
  if (!percent || percent <= 0) return undefined;
  if (percent <= 20) return FanSpeed.LOWER;
  if (percent <= 40) return FanSpeed.LOW;
  if (percent <= 60) return FanSpeed.MEDIUM;
  if (percent <= 80) return FanSpeed.HIGH;
  return FanSpeed.HIGHER;
}

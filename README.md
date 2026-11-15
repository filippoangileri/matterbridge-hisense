# matterbridge-hisense

Plugin per [Matterbridge](https://github.com/Luligu/matterbridge) che espone i **climatizzatori Hisense con
modulo Wi-Fi AEH-W4B1** (e simili basati sul cloud Ayla Networks) come dispositivi **Matter**. In questo modo
li controlli con Alexa (es. Echo Dot 4), Google Home o Apple Casa, **senza skill e senza cloud aggiuntivi**.

```
Climatizzatori ⇄ cloud Ayla ⇄ Raspberry Pi (Matterbridge + questo plugin) ⇄ Matter ⇄ Echo / Alexa
```

| Cosa | Matter | Proprietà Ayla |
|---|---|---|
| Accensione / spegnimento | `systemMode` Off (o On/Off con `airConditioner`) | `t_power` |
| Temperatura impostata (16–32 °C) | `occupiedHeating/CoolingSetpoint` | `t_temp` |
| Modalità caldo / freddo / auto / deumidifica / ventola | `systemMode` | `t_work_mode` |
| Temperatura ambiente | `localTemperature` | `f_temp_in` |
| Velocità ventola (solo `airConditioner`) | `FanControl` | `t_fan_speed` |

## Requisiti

- Raspberry Pi (o altro Linux) con sistema **64 bit**, **Node.js 24 LTS**, Matterbridge ≥ 3.11
- Rete locale con **IPv6 attivo**; il Pi e l'Echo devono stare sulla stessa rete
- Account dell'app con cui controlli i climatizzatori

## Installazione

```bash
git clone https://github.com/filippoangileri/matterbridge-hisense.git
cd matterbridge-hisense
npm install
npm link matterbridge      # usa i tipi della Matterbridge installata globalmente
npm run build
matterbridge --add .
```

Poi apri il frontend di Matterbridge (`http://<ip-del-pi>:8283`), vai sulle impostazioni del plugin e configura
**email**, **password** e **app**. Riavvia Matterbridge, poi abbina Matterbridge ad Alexa: nell'app Alexa scegli
*+ → Dispositivo → Matter* e scansiona il QR code mostrato nel frontend.

## Configurazione

| Campo | Default | Note |
|---|---|---|
| `email`, `password` | | Credenziali dell'app |
| `app` | `oem-eu` | Codice dell'app, vedi tabella sotto |
| `deviceType` | `thermostat` | `thermostat`: massima compatibilità. `airConditioner`: aggiunge accensione e ventola, se il controller lo supporta |
| `namePrefix` | `Condizionatore ` | Il nome in Alexa diventa prefisso + nome dell'app |
| `pollInterval` | `30` | Secondi tra due letture dal cloud (minimo 15) |
| `whiteList` / `blackList` | `[]` | Nomi o DSN dei climatizzatori |

Codici delle app (da [deiger/AirCon](https://github.com/deiger/AirCon)):

| App | Codice |
|---|---|
| Hi-Smart AC | `oem-eu` |
| HiSmart Life | `hisense-eu` |
| WiFi AC | `mid-eu` |
| Smart-Living | `hismart-eu` |
| HiSmart Home (USA) | `hisense-us` |

Ogni app ha **un proprio archivio utenti**: con il codice sbagliato il login risponde "Invalid email or password".
Dopo **5 tentativi errati** Ayla blocca l'account, per cui il plugin prova il login **una sola volta per avvio**.

## Note

- Le API di `oem-eu` sono in °F: il plugin converte automaticamente in °C. Alcuni firmware restituiscono valori
  nell'unità sbagliata (es. `t_temp = 32` in ventilazione) e vengono corretti con una soglia di plausibilità.
- Il climatizzatore ha un solo setpoint, quindi i setpoint di riscaldamento e raffrescamento Matter sono sempre uguali.
- Lo stato viene letto dal cloud ogni `pollInterval` secondi e 5 secondi dopo ogni comando.
- Se il controller non accetta le modalità *Deumidifica* o *Ventola*, il plugin le mostra come *Auto*.

## Licenza

GPL-3.0. Le credenziali delle app Ayla (`src/apps.ts`) provengono da [deiger/AirCon](https://github.com/deiger/AirCon) (GPL-3.0).

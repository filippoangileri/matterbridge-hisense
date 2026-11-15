// Generato da app_mappings.py di deiger/AirCon (GPL-3.0): credenziali delle app mobili
// basate sul cloud Ayla Networks. Non modificare a mano.

export interface AylaApp {
  appId: string;
  appSecret: string;
  userServer: string;
  devicesServer: string;
  /** true se le API usano i gradi Celsius, false se Fahrenheit */
  celsius: boolean;
}

export const AYLA_APPS: Record<string, AylaApp> = {
  "beko-eu": {
    "appId": "a-Hisense-beko-eu-field-id",
    "appSecret": "a-Hisense-beko-eu-field-qUMK2_crAeJYCmWFBomqiFpQKwc-fnN70x8FkSaMgYQm4THvPXMiKqQ",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": false
  },
  "denali-us": {
    "appId": "DenaliAire-iA-id",
    "appSecret": "DenaliAire-8SewSyDbWtg0O-sCou4AONqV_ZM",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "fglair-cn": {
    "appId": "FGLairField-cn-id",
    "appSecret": "FGLairField-cn-zezg7Y60YpAvy3HPwxvWLnd4Oh4",
    "userServer": "user-field.ayla.com.cn",
    "devicesServer": "ads-field.ayla.com.cn",
    "celsius": false
  },
  "fglair-eu": {
    "appId": "FGLair-eu-id",
    "appSecret": "FGLair-eu-gpFbVBRoiJ8E3QWJ-QRULLL3j3U",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": true
  },
  "fglair-us": {
    "appId": "CJIOSP-id",
    "appSecret": "CJIOSP-Vb8MQL_lFiYQ7DKjN0eCFXznKZE",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "field-us": {
    "appId": "pactera-field-f624d97f-us-id",
    "appSecret": "pactera-field-f624d97f-us-yGII-s44-PGBpYGPWLSAwNz1Cnk",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "haxxair": {
    "appId": "HAXXAIR-id",
    "appSecret": "HAXXAIR-2K-JLS0Aq0mTg2qrmmNYrF6QZjs",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "hisense-eu": {
    "appId": "Hisense-mw-id",
    "appSecret": "Hisense-wO1LLP8rWPr2cIeqvFaI-0m0z60",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": true
  },
  "hisense-us": {
    "appId": "APP1-pg-id",
    "appSecret": "APP1-eATf7zYIjgYKl_ztNG3Yx6M9zp8",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "hismart-eu": {
    "appId": "Hismart-fA-id",
    "appSecret": "Hismart-MAfpBGGmZcQcCCsiDYR3kY-oKZg",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": true
  },
  "hismart-us": {
    "appId": "App1-Lg-id",
    "appSecret": "App1-1isfsGIJGUeHjKpr0Ph59ZMzr3A",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": true
  },
  "huihe-us": {
    "appId": "huihe-d70b5148-field-us-id",
    "appSecret": "huihe-d70b5148-field-us-orxaM7xo-jcuYLzvMKNwofCv9NQ",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "mid-eu": {
    "appId": "a-Hisense-mid-eu-field-id",
    "appSecret": "a-Hisense-mid-eu-field-BSTm7Fej0UKghKsq8ASAzq7lYMQ-d_jE81j2PNLSSRQh0Jjt8quuxgM",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": false
  },
  "mid-us": {
    "appId": "a-Hisense-mid-us-field-id",
    "appSecret": "a-Hisense-mid-us-field-3kN4vgxxOAuZtFqTPvzMmmeY-BQ",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "oem-eu": {
    "appId": "a-Hisense-oem-eu-field-id",
    "appSecret": "a-Hisense-oem-eu-field-YR569cQPGH7l67Gf5PUmQv4jiMs-Bk8secEGY52ZSsJ4rOuCk-UNiWQ",
    "userServer": "user-field-eu.aylanetworks.com",
    "devicesServer": "ads-eu.aylanetworks.com",
    "celsius": false
  },
  "oem-us": {
    "appId": "a-Hisense-oem-us-field-id",
    "appSecret": "a-Hisense-oem-us-field-HWdBUFTRqeziogEZwANYE2r8tZE",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "tornado-us": {
    "appId": "a-Hisense-tornado-us-field-id",
    "appSecret": "a-Hisense-tornado-us-field-h0_yLiY7WPv2TP1ScScPCTYM_Sk",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "winia-us": {
    "appId": "a-Hisense-winia-us-field-id",
    "appSecret": "a-Hisense-winia-us-field-61_Ossb_YKn6qHIcC0j44jenVew",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "wwh-us": {
    "appId": "a-Hisense-wwh-us-field-id",
    "appSecret": "a-Hisense-wwh-us-field-KMs5d8XJt6t7Kms4VCFZYqrP0IU",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  },
  "york-us": {
    "appId": "a-Hisense-york-us-field-id",
    "appSecret": "a-Hisense-york-us-field-xkF_SHlWPLKi3jwfe2OpDXSfee8",
    "userServer": "user-field.aylanetworks.com",
    "devicesServer": "ads-field.aylanetworks.com",
    "celsius": false
  }
};

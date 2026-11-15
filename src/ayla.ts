/**
 * Client minimale per il cloud Ayla Networks usato dai moduli Hisense AEH-W4B1.
 * Porting di hisense-alexa/lambda/ayla.py (verificato sui climatizzatori reali).
 */
import { AYLA_APPS, type AylaApp } from './apps.js';

const HTTP_TIMEOUT_MS = 10_000;

export class AylaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AylaError';
  }
}

export class AylaAuthError extends AylaError {
  override name = 'AylaAuthError';
}

/** Email/password rifiutate: NON va ritentato (Ayla blocca l'account dopo 5 errori). */
export class AylaLoginError extends AylaAuthError {
  override name = 'AylaLoginError';
}

export interface AylaDevice {
  dsn: string;
  product_name?: string;
  model?: string;
  oem_model?: string;
  sw_version?: string;
  mac?: string;
  connection_status?: string;
  [key: string]: unknown;
}

export type AylaProperties = Record<string, unknown>;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export class AylaClient {
  readonly app: AylaApp;
  private accessToken?: string;
  private refreshToken?: string;
  private expiresAt = 0;
  private loginError?: string;
  private pendingToken?: Promise<string>;

  constructor(
    private readonly email: string,
    private readonly password: string,
    readonly appName = 'oem-eu',
  ) {
    const app = AYLA_APPS[appName];
    if (!app) {
      throw new AylaError(`App sconosciuta: ${appName}. Valori validi: ${Object.keys(AYLA_APPS).join(', ')}`);
    }
    this.app = app;
  }

  /** true se le API di questa app usano i °C, false se i °F. */
  get celsius(): boolean {
    return this.app.celsius;
  }

  // ------------------------------------------------------------------ HTTP

  private async http<T>(method: string, url: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: token ? `auth_token ${token}` : 'none',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (err) {
      throw new AylaError(`${method} ${url}: ${(err as Error).message}`);
    }
    const text = await res.text();
    if (!res.ok) {
      const message = `${method} ${url}: HTTP ${res.status} ${text.slice(0, 300)}`;
      if (res.status === 401 || res.status === 403) throw new AylaAuthError(message, res.status);
      throw new AylaError(message, res.status);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://${this.app.devicesServer}/apiv1/${path}`;
    try {
      return await this.http<T>(method, url, body, await this.token());
    } catch (err) {
      if (err instanceof AylaLoginError || !(err instanceof AylaAuthError)) throw err;
      // Token revocato/scaduto prima del previsto: nuovo token e un solo retry.
      this.accessToken = undefined;
      this.expiresAt = 0;
      return this.http<T>(method, url, body, await this.token());
    }
  }

  // ------------------------------------------------------------------ Auth

  private storeTokens(resp: TokenResponse): void {
    this.accessToken = resp.access_token;
    this.refreshToken = resp.refresh_token;
    // Margine di 5 minuti sulla scadenza.
    this.expiresAt = Date.now() + ((resp.expires_in ?? 3600) - 300) * 1000;
  }

  private async login(): Promise<void> {
    if (this.loginError) {
      // Dopo un login rifiutato non ritentare finché il plugin non viene riavviato
      // (es. dopo aver corretto la configurazione): evita il blocco dell'account.
      throw new AylaLoginError(`Login già fallito, non ritento: ${this.loginError}`);
    }
    const body = {
      user: {
        email: this.email,
        password: this.password,
        application: { app_id: this.app.appId, app_secret: this.app.appSecret },
      },
    };
    try {
      this.storeTokens(await this.http<TokenResponse>('POST', `https://${this.app.userServer}/users/sign_in.json`, body));
    } catch (err) {
      if (err instanceof AylaAuthError) {
        this.loginError = err.message;
        throw new AylaLoginError(err.message, err.status);
      }
      throw err;
    }
  }

  private async refresh(): Promise<void> {
    const body = { user: { refresh_token: this.refreshToken } };
    this.storeTokens(await this.http<TokenResponse>('POST', `https://${this.app.userServer}/users/refresh_token.json`, body));
  }

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    // Una sola richiesta di token alla volta anche con più chiamate in parallelo.
    this.pendingToken ??= (async () => {
      try {
        if (this.refreshToken) {
          try {
            await this.refresh();
            return this.accessToken as string;
          } catch {
            this.refreshToken = undefined;
          }
        }
        await this.login();
        return this.accessToken as string;
      } finally {
        this.pendingToken = undefined;
      }
    })();
    return this.pendingToken;
  }

  // ------------------------------------------------------------------ Dispositivi

  async devices(): Promise<AylaDevice[]> {
    const items = (await this.api<{ device: AylaDevice }[]>('GET', 'devices.json')) ?? [];
    return items.map((item) => item.device);
  }

  async properties(dsn: string): Promise<AylaProperties> {
    const items = (await this.api<{ property: { name: string; value: unknown } }[]>('GET', `dsns/${dsn}/properties.json`)) ?? [];
    return Object.fromEntries(items.map(({ property }) => [property.name, property.value]));
  }

  async setProperty(dsn: string, name: string, value: number): Promise<void> {
    await this.api('POST', `dsns/${dsn}/properties/${name}/datapoints.json`, { datapoint: { value } });
  }
}

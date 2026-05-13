/**
 * Authentication for Alpaca Trading API requests.
 * OAuth bearer tokens (user sign-in) or API keys (optional server bootstrap) implement this interface.
 */
export type AlpacaRequestAuth = {
  headers: Record<string, string>;
};

export interface AlpacaAuthProvider {
  getTradingAuth(): Promise<AlpacaRequestAuth>;
}

export class AlpacaOAuthBearerAuthProvider implements AlpacaAuthProvider {
  constructor(private readonly accessToken: string) {}

  async getTradingAuth(): Promise<AlpacaRequestAuth> {
    return {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };
  }
}

export class AlpacaApiKeyAuthProvider implements AlpacaAuthProvider {
  constructor(
    private readonly keyId: string,
    private readonly secretKey: string,
  ) {}

  async getTradingAuth(): Promise<AlpacaRequestAuth> {
    return {
      headers: {
        "APCA-API-KEY-ID": this.keyId,
        "APCA-API-SECRET-KEY": this.secretKey,
      },
    };
  }
}

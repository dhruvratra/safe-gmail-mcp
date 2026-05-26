import { TokenStore } from "./tokenStore.js";

export interface AuthStatusProvider {
  isAuthenticated(): Promise<boolean>;
}

export class TokenAuthStatusProvider implements AuthStatusProvider {
  constructor(private readonly tokenStore: TokenStore) {}

  async isAuthenticated(): Promise<boolean> {
    return this.tokenStore.hasUsableTokens();
  }
}

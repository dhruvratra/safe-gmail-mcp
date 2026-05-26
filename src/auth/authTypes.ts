export type OAuthClientSource = "env" | "config" | "default";

export interface AuthPageState {
  clientId?: string;
  clientIdSource?: OAuthClientSource;
  clientSecret?: string;
  clientSecretSource?: OAuthClientSource;
  localClientId?: string;
  hasLocalClientSecret?: boolean;
}

export interface AuthLandingPageOptions {
  clientId?: string;
  clientIdSource?: OAuthClientSource;
  hasClientSecret?: boolean;
  clientSecretSource?: OAuthClientSource;
  localClientId?: string;
  hasLocalClientSecret?: boolean;
  useOwnApp?: boolean;
  configFileDisplay?: string;
}

export class SafeGmailError extends Error {
  constructor(
    message: string,
    readonly code = "SAFE_GMAIL_ERROR",
  ) {
    super(message);
    this.name = "SafeGmailError";
  }
}

export class ConfigError extends SafeGmailError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class AuthError extends SafeGmailError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof SafeGmailError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return "Operation failed: " + error.message.slice(0, 200);
  }
  return "Operation failed.";
}

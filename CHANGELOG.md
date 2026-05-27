# Changelog

## 0.2.0

- Added Gmail read tools for listing unread headers and reading one body by
  message ID.
- Switched OAuth to the Gmail modify scope so messages can be read and labeled.
- Added automatic `Safe Gmail MCP/Processed` labeling after body reads.
- Kept Gmail unread state unchanged when applying the processed label.
- Updated docs and packaging metadata for read support.

## 0.1.0

- Initial public package structure.
- Local loopback OAuth with PKCE and CSRF state.
- Gmail send-only OAuth scope.
- Built-in shared Google Desktop OAuth app defaults with BYO override support.
- `safegmail disconnect` token cleanup and `disconnect --all` local-state cleanup.
- Auth UI controls for viewing, changing, deleting, or returning from BYO OAuth credentials.
- Two-step `prepare_send_email` and `confirm_send_email` MCP flow.
- Optional bulk-send MCP flow with separate confirmation, separate enable flag, and 25-message batch cap.
- Local pending sends, audit log, allowlist, blocklist, and tests.

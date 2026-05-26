# Safe Gmail MCP

Safe Gmail MCP is a local Model Context Protocol server for sending Gmail
messages through an explicit two-step confirmation flow.

It only requests:

```text
https://www.googleapis.com/auth/gmail.send
```

It does not request mailbox read, modify, delete, label, settings, forwarding,
attachment download, or `mail.google.com` scopes.

## Project Note

Safe Gmail MCP was initially built as an internal tool for BLISS-AI. Much of the
implementation was AI-assisted, and not every line has been thoroughly vetted.
The tool was created with good intentions and a security-first design, but you
should still review it before relying on it for sensitive workflows.

Please use it, let us know if you face any issues, and send improvements if you
find something that should be tightened. We plan to keep maintaining it.

Try Bliss AI: https://www.MeditatewithBliss.com

## Security Model

- OAuth uses a localhost-only browser flow with PKCE and CSRF `state`.
- The redirect URI is loopback only:
  `http://127.0.0.1:<port>/oauth/callback`.
- Tokens stay on the user's machine under `~/.safe-gmail-mcp/`.
- Token files are written with restrictive permissions, `0600` where the OS
  supports it.
- Access tokens, refresh tokens, client secrets, email bodies, and attachment
  contents are never logged.
- Sending is disabled unless `SAFE_GMAIL_MCP_ENABLE_SEND=true`.
- Bulk sending is disabled unless both `SAFE_GMAIL_MCP_ENABLE_SEND=true` and
  `SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true` are set.
- Email cannot be sent from a single tool call. The client must call
  `prepare_send_email`, inspect the returned digest and preview, then call
  `confirm_send_email` with the exact digest.
- Bulk email follows the same prepare/confirm pattern with a separate batch
  digest and a 25-message maximum batch size.
- Pending sends expire after 10 minutes by default.
- v1 does not support arbitrary local file attachments.

## Install

```bash
npm install -g safe-gmail-mcp
```

Then run:

```bash
safegmail connect
```

By default, this fetches Safe Gmail's default Google OAuth app metadata from a
BLISS-controlled HTTPS endpoint and opens Google login directly. The local
browser UI also has a **Use my own Google OAuth app** option for users who
prefer their own Google Cloud project.

Or run with `npx` from an MCP client:

```bash
npx -y safe-gmail-mcp --help
```

## Google OAuth Setup

Public/native OAuth clients cannot keep a client secret as a real package
secret. This package does not commit or publish the default Google OAuth client
ID or client secret. Instead, it fetches default OAuth app metadata at runtime
from:

```text
https://www.meditatewithbliss.com/.well-known/safe-gmail-mcp/oauth-client.json
```

That endpoint returns only OAuth app metadata, not user tokens. Safe Gmail MCP
still uses the OAuth Authorization Code flow with PKCE, and Gmail tokens stay on
the user's machine.

Expected endpoint shape:

```json
{
  "clientId": "YOUR_DEFAULT_CLIENT_ID.apps.googleusercontent.com",
  "clientSecret": "YOUR_DEFAULT_CLIENT_SECRET",
  "scope": "https://www.googleapis.com/auth/gmail.send"
}
```

The simplest path is:

```bash
safegmail connect
```

Click **Connect Gmail** and complete Google login. Gmail tokens stay only on
your machine.

If you do not want to trust the fetched default OAuth app, click **Use my own
Google OAuth app** in the local UI. Paste your Google Desktop OAuth client ID
and client secret there; they will be saved only to
`~/.safe-gmail-mcp/config.json` with restrictive permissions.

When BYO credentials are saved, `safegmail connect` shows the saved client ID,
whether a secret is saved, and actions to change it, delete it, or return to the
fetched default Safe Gmail OAuth app.

You can also provide it with an environment variable:

```bash
export SAFE_GMAIL_MCP_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
export SAFE_GMAIL_MCP_GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

or directly in `~/.safe-gmail-mcp/config.json`:

```json
{
  "googleClientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "googleClientSecret": "YOUR_CLIENT_SECRET"
}
```

Broad public distribution with the Gmail send scope may require Google OAuth
app verification. This project does not include a hosted token broker; tokens
stay local.

## Auth Flow

```bash
safegmail connect
```

The long-form command is also supported:

```bash
safe-gmail-mcp auth
```

The CLI starts a web server bound only to `127.0.0.1` on a random available port
and opens:

```text
http://127.0.0.1:<port>
```

The page shows the app name, requested Gmail scope, a Connect Gmail button, and
a safety note. If default OAuth metadata can be fetched, Connect Gmail opens
Google login directly. If it cannot be fetched, the page falls back to BYO
OAuth app fields. The page also offers **Use my own Google OAuth app** for
local-only BYO credentials. After Google redirects back to the loopback
callback, the CLI verifies `state`, exchanges the code using PKCE, writes tokens
under `~/.safe-gmail-mcp/`, and exits.

Check status:

```bash
safe-gmail-mcp auth status
```

Disconnect Gmail tokens only:

```bash
safegmail disconnect
```

This deletes `~/.safe-gmail-mcp/tokens.json`. It does not delete saved BYO
OAuth app credentials, recipient policy, pending sends, or the audit log.

Delete all local Safe Gmail MCP state before uninstalling:

```bash
safegmail disconnect --all
```

This deletes `~/.safe-gmail-mcp/`, including Gmail tokens, saved BYO OAuth app
credentials, pending sends, config, and audit log.

The long-form token-only logout remains available:

```bash
safe-gmail-mcp auth logout
```

## MCP Client Config

Claude Desktop example:

```json
{
  "mcpServers": {
    "safe-gmail": {
      "command": "npx",
      "args": ["-y", "safe-gmail-mcp", "serve"],
      "env": {
        "SAFE_GMAIL_MCP_ENABLE_SEND": "false",
        "SAFE_GMAIL_MCP_ENABLE_BULK_SEND": "false"
      }
    }
  }
}
```

Set `SAFE_GMAIL_MCP_ENABLE_SEND=true` only after you are comfortable with the
confirmation flow and local recipient policy.
Set `SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true` only if you also want confirmed bulk
batches to send.

## Tools

### `prepare_send_email`

Inputs:

```json
{
  "to": ["person@example.com"],
  "cc": ["optional@example.com"],
  "bcc": ["optional-bcc@example.com"],
  "subject": "Subject",
  "body": "Plain text body",
  "htmlBody": "<p>Optional HTML alternative</p>"
}
```

This validates recipients, applies allowlist/blocklist rules, writes a local
pending send record, and returns:

- pending ID
- SHA-256 digest of the canonical payload
- preview with recipients, subject, body length, HTML presence, and expiry

It does not send email.

### `confirm_send_email`

Inputs:

```json
{
  "pendingId": "PENDING_ID_FROM_PREPARE",
  "digest": "DIGEST_FROM_PREPARE"
}
```

This sends only when:

- `SAFE_GMAIL_MCP_ENABLE_SEND=true`
- Gmail is authenticated
- the pending record exists
- the pending record has not expired
- the digest exactly matches the canonical payload

Returns the Gmail message ID on success.

### `list_pending_sends`

Lists pending IDs, recipients, subject, created time, expiry time, and digest.
It does not show the full body by default.

### `discard_pending_send`

Deletes a pending send without sending it.

### `prepare_bulk_send`

Inputs:

```json
{
  "messages": [
    {
      "to": ["person@example.com"],
      "subject": "Subject",
      "body": "Plain text body",
      "htmlBody": "<p>Optional HTML alternative</p>"
    }
  ]
}
```

This validates and stages up to 25 email messages as one batch. It applies the
same recipient allowlist/blocklist rules to every message, stores a local
pending bulk record, and returns:

- pending bulk ID
- SHA-256 digest of the canonical batch payload
- preview with message count, recipients, subjects, and expiry

It does not send email.

### `confirm_bulk_send`

Inputs:

```json
{
  "pendingBulkId": "PENDING_BULK_ID_FROM_PREPARE",
  "digest": "DIGEST_FROM_PREPARE"
}
```

This sends the prepared batch sequentially only when:

- `SAFE_GMAIL_MCP_ENABLE_SEND=true`
- `SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true`
- Gmail is authenticated
- the pending bulk record exists
- the pending bulk record has not expired
- the digest exactly matches the canonical batch payload

Returns Gmail message IDs and sent count on success.

### `list_pending_bulk_sends`

Lists pending bulk IDs, message counts, recipients, subjects, created time,
expiry time, and digest. It does not show full bodies by default.

### `discard_pending_bulk_send`

Deletes a pending bulk send without sending it.

## Config Reference

Config file:

```text
~/.safe-gmail-mcp/config.json
```

Example:

```json
{
  "googleClientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "googleClientSecret": "YOUR_CLIENT_SECRET",
  "allowedRecipients": ["example.com", "person@example.org"],
  "blockedRecipients": ["blocked@example.com", "blocked-domain.example"],
  "pendingTtlMinutes": 10,
  "fromEmail": "your-account@example.com"
}
```

Allowlist behavior:

- exact email entries match one address
- domain entries match any address at that exact domain
- if an allowlist exists, all other recipients are blocked

Blocklist behavior:

- exact email entries block one address
- domain entries block any address at that exact domain
- blocklist takes precedence over allowlist

`fromEmail` is optional and only controls the RFC 822 `From` header. Gmail still
sends as the authenticated account or configured Gmail alias.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SAFE_GMAIL_MCP_GOOGLE_CLIENT_ID` | Overrides the config or fetched default OAuth client ID. |
| `SAFE_GMAIL_MCP_GOOGLE_CLIENT_SECRET` | Overrides the config or fetched default Google Desktop app client secret. |
| `SAFE_GMAIL_MCP_DEFAULT_OAUTH_URL` | Overrides the default OAuth metadata endpoint. |
| `SAFE_GMAIL_MCP_ENABLE_SEND=true` | Enables `confirm_send_email` to actually call Gmail. |
| `SAFE_GMAIL_MCP_ENABLE_BULK_SEND=true` | Enables `confirm_bulk_send`; also requires `SAFE_GMAIL_MCP_ENABLE_SEND=true`. |

## Local Files

Safe Gmail MCP stores local state outside the repository:

```text
~/.safe-gmail-mcp/
  config.json
  tokens.json
  pending/
  pending-bulk/
  audit.log
```

The audit log records timestamp, action, recipients, subject, digest, result,
and a short error summary. It does not record full bodies or tokens.

## Limitations

- Send-only Gmail scope.
- No mailbox read.
- No delete, labels, filters, forwarding rules, or settings tools.
- No arbitrary local file attachments in v1.
- Bulk sends are capped at 25 messages per prepared batch and are sent
  sequentially.
- No hosted token broker.
- First-time default auth depends on the default OAuth metadata endpoint being
  reachable. BYO OAuth credentials work without that endpoint.
- Inbox placement is not guaranteed by Gmail API usage.

## Threat Model

Primary risks:

- a malicious MCP client trying to send email without user review
- token theft from local disk
- prompt injection asking the model to exfiltrate email content or send to an
  attacker-controlled address
- accidental sends to the wrong recipient

Mitigations:

- two-step prepare/confirm with digest binding
- sending disabled by default
- bulk sending has an additional opt-in and batch size cap
- recipient allowlist/blocklist
- short pending-send expiry
- local-only OAuth callback
- PKCE and CSRF state
- restrictive local token file permissions
- no email body in pending list or audit log
- no mailbox read tools

Residual risks:

- any local process running as the same OS user may be able to access that
  user's files
- an MCP client with send enabled can still ask for confirmation, so users must
  inspect the preview and digest
- the default OAuth app metadata endpoint is public and requires trust in the
  BLISS-controlled endpoint unless users bring their own OAuth client ID

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Tests use a mock Gmail client and must not call Google APIs.

## Release Notes

Use npm provenance where feasible:

```bash
npm publish --provenance
```

Before publishing, run:

```bash
npm ci
npm test
npm run build
npm pack --dry-run
npm run smoke:pack
```

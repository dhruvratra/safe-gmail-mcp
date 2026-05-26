# Contributing

## Maintainer Note

Safe Gmail MCP started as an internal BLISS-AI tool. Much of the implementation
was AI-assisted, and not every line has been thoroughly vetted, so small,
auditable contributions and security-minded reviews are especially welcome.

Try Bliss AI: https://www.MeditatewithBliss.com

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Do not use real Gmail accounts in tests. Tests must use mocks and must never
call Google APIs or send real email.

## Security Rules

- Do not add Gmail read, modify, delete, label, forwarding, settings, or
  `mail.google.com` scopes.
- Do not log tokens, client secrets, email bodies, or attachment contents.
- Do not add arbitrary local file attachment support without a separate design
  review.
- Keep OAuth tokens and local state outside the repository under
  `~/.safe-gmail-mcp/`.
- Do not commit or publish the default Google OAuth client ID or client secret.
  Default OAuth app metadata must be fetched at runtime.
- Avoid install and postinstall scripts.

## Pull Requests

Keep changes small and auditable. Include tests for guardrail changes, OAuth
changes, MIME construction, or MCP tool behavior.

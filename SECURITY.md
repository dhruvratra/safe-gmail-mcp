# Security Policy

## Project Context

Safe Gmail MCP was initially built as an internal tool for BLISS-AI. Much of the
implementation was AI-assisted, and not every line has been thoroughly vetted.
The project is maintained with good intentions and a security-first design, but
please review it carefully before using it in sensitive environments.

Try Bliss AI: https://www.MeditatewithBliss.com

## Default OAuth App Metadata

The public source and npm package must not embed the default Google OAuth client
ID or client secret. Safe Gmail MCP fetches default OAuth app metadata at
runtime from a BLISS-controlled HTTPS endpoint. The endpoint returns only OAuth
app metadata; user OAuth tokens still stay on the user's machine.

## Gmail Data Handling

Safe Gmail MCP requests the Gmail modify scope so it can list unread message
headers, read a specific message body only after an explicit tool call, send
messages through Gmail after confirmation, and apply its processed label.

Gmail OAuth tokens, pending sends, config, and audit logs are stored locally
under `~/.safe-gmail-mcp/`. Bliss AI servers do not store Gmail OAuth tokens or
Gmail message contents for Safe Gmail MCP.

The public product pages for Safe Gmail MCP are:

- https://www.meditatewithbliss.com/safe-gmail-mcp
- https://www.meditatewithbliss.com/safe-gmail-mcp/privacy
- https://www.meditatewithbliss.com/safe-gmail-mcp/terms

## Supported Versions

Security fixes are provided for the latest published minor version.

## Reporting Vulnerabilities

Please report suspected vulnerabilities privately by opening a GitHub security
advisory or emailing the maintainer address listed in the repository.

Include:

- affected version or commit
- impact
- reproduction steps
- whether tokens, email content, or recipient data may be exposed

Do not include real OAuth tokens, refresh tokens, client secrets, private email
bodies, or attachment contents in reports.

## Response Expectations

Maintainers should acknowledge reports within 5 business days, triage severity,
and publish a fix or mitigation plan when the issue is confirmed.

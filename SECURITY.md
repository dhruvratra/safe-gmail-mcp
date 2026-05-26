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

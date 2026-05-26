import { APP_NAME } from "../constants.js";
import type { AuthLandingPageOptions } from "./authTypes.js";

const BLISS_LOGO_URL = "https://www.meditatewithbliss.com/assets/brand/bliss_logo.png";

export function renderAuthLandingPage(options: AuthLandingPageOptions): string {
  const useConfigured = Boolean(
    options.clientId && options.hasClientSecret && !options.useOwnApp,
  );
  const method = useConfigured ? "GET" : "POST";
  const action = options.useOwnApp ? "/oauth/start?mode=byo" : "/oauth/start";
  const ownAppLink = useConfigured
    ? `<a class="quiet-link" href="/?mode=byo">Use my own Google app</a>`
    : "";
  const sharedAppLink =
    options.useOwnApp && options.clientId && options.hasClientSecret
      ? `<a class="quiet-link" href="/">Use default Google app</a>`
      : "";
  const credentialFields = useConfigured
    ? ""
    : renderCredentialFields(options.configFileDisplay);
  const credentialSummary =
    options.localClientId && !options.useOwnApp
      ? renderSavedAppSummary(options.localClientId, options.hasLocalClientSecret)
      : "";

  return renderPage(`
    <section class="waitlist connect-card" aria-labelledby="connect-title">
      <div class="waitlist-copy">
        <h1 id="connect-title">Connect Gmail</h1>
        <p class="lead">Send-only Gmail. You approve every email.</p>
      </div>

      <div class="store-links connect-links">
        <form class="connect-form" method="${method}" action="${action}">
          ${credentialFields}
          <button class="store-link connect-button" type="submit">
            <span class="store-icon google-icon" aria-hidden="true">${googleLogo()}</span>
            <span class="store-copy">
              <span class="store-name">Continue with Google</span>
            </span>
          </button>
        </form>
        <div class="secondary-actions">
          ${ownAppLink}
          ${sharedAppLink}
        </div>
      </div>

      ${credentialSummary}
    </section>
  `);
}

export function renderStatusPage(title: string, detail = ""): string {
  const detailHtml = detail
    ? `<p class="lead">${escapeHtml(detail)}</p>`
    : "";
  return renderPage(`
    <section class="waitlist status-card" aria-live="polite">
      <div class="waitlist-copy status-copy">
        <img class="status-logo" src="${BLISS_LOGO_URL}" alt="Bliss AI">
        <p class="eyebrow">Safe Gmail MCP</p>
        <h1>${escapeHtml(title)}</h1>
        ${detailHtml}
      </div>
    </section>
  `);
}

function renderCredentialFields(configFileDisplay?: string): string {
  return `
    <div class="credential-fields">
      <label for="googleClientId">Client ID</label>
      <input id="googleClientId" name="googleClientId" type="text" inputmode="text" spellcheck="false" autocomplete="off" placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com" required>
      <label for="googleClientSecret">Client secret</label>
      <input id="googleClientSecret" name="googleClientSecret" type="password" spellcheck="false" autocomplete="off" placeholder="GOCSPX-..." required>
      <p class="hint">Saved at ${escapeHtml(configFileDisplay ?? "~/.safe-gmail-mcp/config.json")}.</p>
    </div>`;
}

function renderSavedAppSummary(
  localClientId: string,
  hasLocalClientSecret?: boolean,
): string {
  return `
    <section class="saved-app-section" aria-label="Saved Google app">
      <div class="saved-app-heading">
        <p class="eyebrow">Custom app saved</p>
        <h2>Saved Google app</h2>
      </div>
      <dl class="saved-app">
        <dt>ID</dt>
        <dd><code>${escapeHtml(localClientId)}</code></dd>
        <dt>Secret</dt>
        <dd><code>${hasLocalClientSecret ? "Saved locally" : "Not saved"}</code></dd>
      </dl>
      <div class="actions">
        <a href="/?mode=byo">Change</a>
        <form class="inline" method="POST" action="/oauth/delete-local-app">
          <button class="link-button" type="submit">Use default</button>
        </form>
      </div>
    </section>`;
}

function renderPage(content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap");

    :root {
      --bg-rgb: 248 243 234;
      --bg-tint-rgb: 231 216 194;
      --text-rgb: 34 31 27;
      --muted-rgb: 110 100 87;
      --accent-rgb: 208 138 53;
      --bg: rgb(var(--bg-rgb));
      --text: rgb(var(--text-rgb));
      --muted: rgb(var(--muted-rgb));
      --accent: rgb(var(--accent-rgb));
      --font-ui: "Inter", "Avenir Next", "Segoe UI", sans-serif;
      --fs-xs: 0.75rem;
      --fs-sm: 0.875rem;
      --fs-lg: 1.5rem;
      --pine: var(--text);
      --ink: var(--text);
      --line: rgb(var(--text-rgb) / 0.16);
      --glass: rgb(var(--bg-rgb) / 0.72);
      --shadow-lg: 0 24px 52px rgb(var(--text-rgb) / 0.15);
      --shadow-sm: 0 10px 24px rgb(var(--text-rgb) / 0.09);
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
    }

    body {
      min-height: 100svh;
      font-family: var(--font-ui);
      font-size: var(--fs-sm);
      color: var(--ink);
      background: linear-gradient(
        180deg,
        rgb(var(--bg-tint-rgb) / 0.88) 0%,
        rgb(var(--bg-tint-rgb) / 0.98) 48%,
        rgb(210 194 169) 100%
      );
      overflow-x: hidden;
    }

    .atmosphere {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      isolation: isolate;
    }

    .grain {
      position: absolute;
      inset: 0;
      opacity: 0.18;
      background-image: radial-gradient(rgb(var(--text-rgb) / 0.14) 0.5px, transparent 0.5px);
      background-size: 3px 3px;
    }

    .site-shell {
      position: relative;
      z-index: 1;
      width: min(1040px, calc(100% - 2.4rem));
      min-height: 100svh;
      margin-inline: auto;
      padding-top: 5.1rem;
      display: flex;
      flex-direction: column;
    }

    .topbar {
      margin-top: 0;
      padding: 0.54rem 0.72rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: var(--glass);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.8rem;
      position: fixed;
      top: 0.8rem;
      left: 50%;
      transform: translateX(-50%);
      width: min(1040px, calc(100% - 2.4rem));
      z-index: 40;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.12rem;
      text-decoration: none;
      min-width: 0;
    }

    .brand,
    .byline {
      color: var(--pine);
      font-size: var(--fs-xs);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .brand span {
      display: inline-block;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .byline {
      display: inline-flex;
      align-items: center;
      gap: 0.26rem;
      text-decoration: none;
      white-space: nowrap;
    }

    .brand-mark {
      width: 38px;
      height: 32px;
      object-fit: contain;
      display: block;
      margin-left: -0.12rem;
    }

    .chip {
      padding: 0.36rem 0.62rem;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--pine);
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-xs);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, filter 180ms ease;
    }

    .chip-solid {
      border-color: rgb(var(--accent-rgb) / 0.44);
      color: rgb(var(--bg-rgb) / 0.98);
      background: linear-gradient(180deg, rgb(var(--accent-rgb) / 0.92), rgb(var(--accent-rgb) / 0.78));
      box-shadow:
        0 10px 22px rgb(var(--accent-rgb) / 0.26),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.36);
    }

    main {
      flex: 1;
      display: grid;
      align-items: center;
      padding: 2rem 0 4rem;
    }

    .waitlist {
      margin: 0 auto;
      max-width: min(940px, 100%);
      min-height: 410px;
      padding: 1.75rem 1.65rem;
      border: 1px solid rgb(var(--text-rgb) / 0.13);
      border-radius: 22px;
      background: rgb(var(--bg-rgb) / 0.52);
      backdrop-filter: blur(18px) saturate(1.04);
      -webkit-backdrop-filter: blur(18px) saturate(1.04);
      box-shadow:
        0 14px 34px rgb(var(--text-rgb) / 0.1),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.82);
      display: grid;
      grid-template-columns: minmax(250px, 0.9fr) minmax(360px, 1.1fr);
      gap: 1.7rem;
      align-items: stretch;
    }

    .waitlist-copy {
      width: 100%;
      max-width: 30ch;
      justify-self: center;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .eyebrow {
      margin: 0 0 0.3rem;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      font-size: var(--fs-xs);
      font-weight: 700;
      color: var(--muted);
    }

    h1,
    h2 {
      margin: 0;
      font-family: var(--font-ui);
      color: var(--pine);
      font-weight: 600;
    }

    h1 {
      margin-top: 0.14rem;
      font-size: var(--fs-lg);
      line-height: 1.16;
      letter-spacing: 0;
    }

    h2 {
      font-size: 1rem;
      line-height: 1.25;
      letter-spacing: 0;
    }

    .lead {
      max-width: 34ch;
      margin: 0.64rem auto 0.42rem;
      color: var(--muted);
      line-height: 1.45;
      font-size: var(--fs-sm);
    }

    .download-trial {
      margin: 0.48rem 0 0;
      text-align: center;
      font-size: var(--fs-xs);
      line-height: 1.3;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(var(--muted-rgb) / 0.78);
    }

    .scope-code {
      display: block;
      margin-top: 0.5rem;
      color: rgb(var(--muted-rgb) / 0.82);
      font-size: 0.72rem;
      line-height: 1.45;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .store-links {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.78rem;
      align-content: center;
      justify-items: center;
    }

    .connect-form {
      width: min(100%, 21rem);
      display: grid;
      gap: 0.78rem;
    }

    .store-link {
      --store-side: 38px;
      display: grid;
      grid-template-columns: var(--store-side) minmax(0, 1fr) var(--store-side);
      align-items: center;
      width: min(100%, 21rem);
      min-height: 64px;
      column-gap: 0.68rem;
      padding: 0.62rem 0.78rem;
      border: 1px solid rgb(var(--text-rgb) / 0.12);
      border-radius: 16px;
      background: rgb(var(--bg-rgb) / 0.78);
      color: var(--pine);
      text-decoration: none;
      box-shadow:
        0 8px 18px rgb(var(--text-rgb) / 0.08),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.82);
      transition:
        transform 180ms ease,
        box-shadow 180ms ease,
        border-color 180ms ease,
        background 180ms ease;
    }

    button.store-link {
      cursor: pointer;
      font: inherit;
    }

    .connect-button:hover {
      border-color: rgb(var(--accent-rgb) / 0.26);
      background: rgb(var(--bg-rgb) / 0.88);
      box-shadow:
        0 10px 22px rgb(var(--text-rgb) / 0.1),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.88);
    }

    .store-link:hover {
      transform: translateY(-1px);
      border-color: rgb(var(--accent-rgb) / 0.26);
      background: rgb(var(--bg-rgb) / 0.88);
      box-shadow:
        0 10px 22px rgb(var(--text-rgb) / 0.1),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.88);
    }

    .store-link::after {
      content: "";
      width: var(--store-side);
      height: 1px;
    }

    .store-icon {
      flex: 0 0 46px;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: rgb(var(--bg-rgb) / 0.92);
      box-shadow: inset 0 1px 0 rgb(var(--bg-rgb) / 0.92);
    }

    .google-icon {
      background: rgb(var(--bg-rgb) / 0.96);
    }

    .google-icon svg {
      width: 20px;
      height: 20px;
      display: block;
    }

    .store-copy {
      display: grid;
      gap: 0.08rem;
      justify-items: center;
      text-align: center;
    }

    .store-name {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--pine);
    }

    .credential-fields {
      display: grid;
      gap: 0.55rem;
      text-align: left;
    }

    label {
      color: var(--pine);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    input {
      display: block;
      width: 100%;
      min-height: 46px;
      padding: 0.7rem 0.84rem;
      border: 1px solid rgb(var(--text-rgb) / 0.13);
      border-radius: 14px;
      color: var(--pine);
      background: rgb(var(--bg-rgb) / 0.78);
      box-shadow: inset 0 1px 0 rgb(var(--bg-rgb) / 0.82);
      font: inherit;
      outline: none;
    }

    input:focus {
      border-color: rgb(var(--accent-rgb) / 0.34);
      box-shadow:
        0 0 0 3px rgb(var(--accent-rgb) / 0.16),
        inset 0 1px 0 rgb(var(--bg-rgb) / 0.88);
    }

    .hint {
      margin: -0.1rem 0 0;
      color: rgb(var(--muted-rgb) / 0.88);
      font-size: 0.76rem;
      line-height: 1.4;
    }

    .secondary-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      min-height: 1.2rem;
    }

    a,
    .link-button {
      color: rgb(var(--muted-rgb) / 0.96);
      font: inherit;
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-decoration-thickness: 1px;
      text-underline-offset: 0.18em;
    }

    .saved-app-section {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(200px, 0.9fr) minmax(280px, 1.1fr);
      gap: 1rem 1.7rem;
      padding-top: 1.15rem;
      border-top: 1px solid rgb(var(--text-rgb) / 0.13);
      align-items: start;
    }

    .saved-app-heading {
      text-align: center;
      justify-self: center;
    }

    .saved-app {
      margin: 0;
      min-width: 0;
    }

    dt {
      margin-top: 0.7rem;
      color: var(--muted);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    dt:first-child {
      margin-top: 0;
    }

    dd {
      margin: 0.22rem 0 0;
      color: var(--pine);
      min-width: 0;
    }

    dd code {
      color: var(--pine);
      font-size: 0.76rem;
      overflow-wrap: anywhere;
    }

    .actions {
      grid-column: 2;
      display: flex;
      gap: 1rem;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
    }

    .inline {
      display: inline;
    }

    .link-button {
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      text-decoration-line: underline;
    }

    .status-card {
      grid-template-columns: 1fr;
      min-height: 370px;
    }

    .status-copy {
      max-width: 34ch;
    }

    .status-logo {
      width: 64px;
      height: 64px;
      object-fit: contain;
      margin-bottom: 1rem;
    }

    :focus-visible {
      outline: 3px solid rgb(var(--accent-rgb) / 0.16);
      outline-offset: 3px;
    }

    @media (max-width: 980px) {
      .site-shell {
        width: min(1100px, calc(100% - 1.4rem));
      }

      .topbar {
        width: min(1100px, calc(100% - 1.4rem));
      }

      .waitlist,
      .saved-app-section {
        grid-template-columns: 1fr;
      }

      .actions {
        grid-column: auto;
      }
    }

    @media (max-width: 640px) {
      .site-shell {
        width: min(560px, calc(100% - 1.08rem));
        padding-top: 4.3rem;
      }

      .topbar {
        top: 0.42rem;
        width: min(560px, calc(100% - 1.08rem));
        padding: 0.4rem 0.48rem;
        border-radius: 16px;
        gap: 0.5rem;
        background: rgb(var(--bg-rgb) / 0.86);
      }

      .brand-mark {
        width: 38px;
        height: 38px;
        margin-right: 0;
      }

      .brand span {
        display: inline-block;
        letter-spacing: 0.12em;
      }

      .chip {
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        padding: 0.36rem 0.72rem;
      }

      main {
        padding: 0.84rem 0 2rem;
      }

      .waitlist {
        min-height: 0;
        padding: 1.35rem 1rem;
        gap: 1.1rem;
      }
    }
  </style>
</head>
<body>
  <div class="atmosphere" aria-hidden="true">
    <div class="grain"></div>
  </div>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="https://www.meditatewithbliss.com" rel="noreferrer" target="_blank" aria-label="Bliss AI home">
        <span>Safe Gmail MCP</span>
      </a>
      <div class="top-actions">
        <a class="byline" href="https://www.meditatewithbliss.com" rel="noreferrer" target="_blank" aria-label="Bliss AI">
          <span>by Bliss AI</span>
          <img class="brand-mark" src="${BLISS_LOGO_URL}" alt="Bliss AI">
        </a>
      </div>
    </header>
    <main>${content}</main>
  </div>
</body>
</html>`;
}

function googleLogo(): string {
  return `<svg viewBox="0 0 18 18" role="img" focusable="false" aria-label="Google">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.94v2.33A9 9 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.16.28-1.71V4.96H.94A9 9 0 0 0 0 9c0 1.45.34 2.82.94 4.04l3.02-2.33Z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .94 4.96l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58Z"/>
  </svg>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

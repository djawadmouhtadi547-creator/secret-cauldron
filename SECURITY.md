# Security policy

## Reporting a vulnerability

Please do not disclose exploitable vulnerabilities in public issues or pull requests. Use GitHub's **Report a vulnerability** flow (Security → Advisories) for this repository when private vulnerability reporting is enabled. If it is unavailable, contact the repository owner privately before publishing technical details.

## Supported versions

Security fixes target the latest version on the default branch. This project is pre-release software; older experimental ZIP builds are not guaranteed to receive fixes.

## Sensitive information

Never include Microsoft refresh tokens, API keys, passwords, full home-directory paths, account identifiers, or unredacted launcher logs in public reports. Keep service credentials in ignored `keys.local.json` or environment variables. The tracked `keys.json` must remain blank.

## Security design notes

- Renderer Node integration is disabled and context isolation is enabled.
- Renderer-to-main calls are exposed only through the preload `window.prime` API.
- IPC handlers accept requests only from the main local renderer frame.
- New windows are denied; only HTTPS external destinations are opened.
- The renderer uses a Content Security Policy and does not load remote scripts.

These controls reduce attack surface but are not a substitute for security review or timely Electron dependency updates.

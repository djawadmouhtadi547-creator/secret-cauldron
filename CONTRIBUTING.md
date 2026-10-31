# Contributing

Thanks for helping improve Prime Launcher.

## Before changing code

1. Read `README.md`, `HANDOFF.md`, and `docs/API_CONTRACT.md`.
2. Keep the app on Electron + HTML/CSS/JavaScript ES Modules unless maintainers explicitly approve an architecture change.
3. Preserve the Arabic RTL experience and verify the English LTR experience for renderer changes.
4. Do not rename IPC channels or change payload shapes without updating the contract, main handlers, preload bridge, tests, and handoff notes together.

## Local checks

```bash
npm install
npm run validate
npm start
```

If a change touches packaging, test the relevant platform build. If a change touches Minecraft launch or loaders, include real version/loader test details rather than relying only on mocks or static assertions.

## Pull requests

- Keep PRs focused and explain the user-visible effect.
- Add/update tests for bug fixes and behavior changes.
- Add Arabic and English strings together; keep translation key parity.
- Never commit `keys.local.json`, `.env`, tokens, user data, or unsanitized logs.
- Update `CHANGELOG.md` and `HANDOFF.md` when behavior or limitations change.
- Use the repository pull request template.

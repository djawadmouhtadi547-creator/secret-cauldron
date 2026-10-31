# Prime Launcher — Phase 4 Test Report

**Date:** 2026-10-31  
**Release line:** `0.4.0-beta.1`  
**Scope:** static validation, Node.js automated tests, repository/release configuration, security boundary checks, and dependency support update.

## Baseline before Phase 4

The Phase 3.1 project was tested before the Phase 4 changes:

- `npm run check`: PASS — 476 matching Arabic/English keys, 60 IPC request channels, 3 events, and 60 SVG icons.
- `npm test`: PASS — 8 tests passed.

## Dependency support update

- Electron updated to `45.2.1`; Electron 33 was end-of-support. Electron 45 is in the currently supported release window as of this report date. [Official Electron release schedule](https://releases.electronjs.org/schedule), [Electron 36 announcement: end of support for 33.x](https://www.electronjs.org/blog/electron-36-0).
- electron-builder updated to `26.18.1`. The upgrade could not be installed or exercised in this network-restricted environment; it must be validated in CI before tagging.
- CI uses Node.js 22.

## Phase 4 checks added

Latest local run on 2026-10-31: `npm run validate` PASS; `npm test` PASS (12 tests, 0 failures); `check:syntax` PASS (55 files); `check:secrets` PASS; `check` PASS (476 i18n keys, 60 IPC requests, 3 events, 60 icons). YAML parsing of the CI workflow, Dependabot config, and both issue forms also passed locally.


- `npm run check:syntax`: syntax-checks `.js`, `.mjs`, and `.cjs` files under `src/`, `scripts/`, and `tests/`.
- `npm run check:secrets`: verifies tracked key templates are blank, the local key file is ignored, and common credential patterns are absent from public source/docs.
- `npm run validate`: runs project checks, syntax checks, secret checks, and automated tests in sequence.
- Four new tests cover renderer trust validation, key management policy, GitHub tag-release workflow configuration, and Electron navigation/CSP restrictions.

## Environment limitation

The container could not resolve `registry.npmjs.org` (`EAI_AGAIN`). No packages were installed from the network. Electron 45.2.1 and electron-builder 26.18.1 are configured in the manifest but not installed or runtime-tested here. Because of this:

- `npm install` and `postinstall` have not been run against the real `skinview3d` dependency in this phase.
- `npm start` has not launched Electron; renderer appearance and IPC checks with Electron's packaged file URL are not confirmed.
- Windows NSIS and Linux AppImage builds have not run locally.
- Minecraft installation/launch across loaders, OAuth, content downloads, server join, and packaged installer smoke tests remain unverified.

## Required CI and device acceptance

1. On a networked checkout, run `npm install` and verify the `skinview3d` browser bundle is copied to `src/renderer/vendor/`.
2. Run `npm run validate`; record exact test count/output.
3. Run `npm start` and verify the renderer loads and all IPC calls are accepted only from the local main frame.
4. Test Arabic RTL and English LTR, offline account, Java manager, memory/custom Java/JVM options, and the full navigation flow.
5. Install/launch Vanilla, Fabric, Forge, NeoForge, and Quilt; test real MRPack/ZIP import/export.
6. Test Modrinth and CurseForge with a valid local CurseForge API key, server ping/join, and offline skin application/viewer.
7. Build and install the NSIS package on Windows and AppImage on Linux.
8. Confirm that local key files, logs, and user data are not included in repository commits or build artifacts.
9. Only after these pass, push the version tag and call the GitHub prerelease accepted.

## Known product gaps

Microsoft OAuth still needs Azure configuration and real-account verification. Several instance tabs, launch hooks, legacy settings, world backup, in-app file explorer, and update checking remain incomplete or limited. See `HANDOFF.md` for current details.

# Prime Launcher — Phase 4 handoff (GitHub readiness)

**Release line:** `0.4.0-beta.1`  
**Scope:** integration review, repository hygiene, Electron IPC trust checks, credential handling, automated validation, and GitHub release automation.

## Completed in Phase 4

- Updated `package.json` and the Arabic/English About screen to `0.4.0-beta.1`.
- Upgraded the unsupported Electron 33 dependency to Electron 45.2.1 and electron-builder 26.18.1; CI now uses Node.js 22.12+.
- Added `npm run validate`, `npm run check:syntax`, and `npm run check:secrets`.
- Extended automated tests to cover IPC renderer trust validation, ignored local credentials, GitHub release workflow presence, and Electron navigation/CSP rules.
- Hardened IPC handlers to accept only requests from the primary `file://` renderer document and reject child frames/other webContents.
- Locked renderer navigation to the loaded document and limited new external windows to HTTPS.
- Tightened CSP with `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`, and `form-action 'self'`.
- Added `keys.local.json` support and `PRIME_AZURE_CLIENT_ID` / `PRIME_CURSEFORGE_API_KEY` environment-variable overrides. Tracked key templates remain blank; `.gitignore` excludes the local file.
- Rebuilt GitHub Actions around a validation job, native Windows/Linux packaging jobs, and automatic GitHub Release creation on `v*` tags.
- Added bug/feature issue forms, pull-request template, `.editorconfig`, `.gitattributes`, Dependabot for npm/GitHub Actions, contributor guidance, security policy, support notes, and release checklists. Release jobs verify the tag matches `package.json`.
- Added `docs/GITHUB_PUBLISH.md` with the commands for placing this source tree in the user's own GitHub repository.

## Verified in the preparation environment

The Phase 3.1 baseline passed before changes: 8 tests. Phase 4 adds four tests; final `npm run validate` passed with 12 tests; see `docs/TEST_REPORT.md`. The current build environment has no access to `registry.npmjs.org`, so dependency installation, `postinstall`, Electron launch, and electron-builder cannot be executed here.

## Still not proven / release blockers

- `npm install` and `skinview3d` postinstall copy on a networked machine.
- Electron 45.2.1 integration and electron-builder 26.18.1 compatibility still need actual install/launch/package verification; the Electron upgrade is not runtime-tested in this environment.
- Actual Electron launch and renderer behavior, including IPC trust checks with the packaged file URL.
- Vanilla/Fabric/Forge/NeoForge/Quilt installation and game launch end-to-end.
- Real Modrinth and CurseForge content downloads, Microsoft OAuth, server joining, skin upload/viewer, and installer smoke tests.
- Windows NSIS and Linux AppImage builds on native GitHub runners.
- A `package-lock.json` is not included because npm registry access was unavailable during this handoff. CI uses `npm install` rather than `npm ci`; generate and commit the lockfile on a networked development machine before a stable release.

## How to publish

Follow `docs/GITHUB_PUBLISH.md`. Upload this directory as the repository contents, verify Actions, complete `docs/RELEASE_CHECKLIST.md` on real devices, then push `v0.4.0-beta.1` to create a prerelease with Windows/Linux assets.

## Non-goals of this handoff

This phase does not claim to finish Microsoft OAuth approval, every instance sub-tab, update delivery, world backups, advanced hooks, or every UI placeholder. See `HANDOFF.md` and `docs/TEST_REPORT.md`; don't advertise any item there as production-ready without implementing and verifying it.

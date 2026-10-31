# Release acceptance checklist

## Before tagging

- [ ] Review all open critical/high issues.
- [ ] Confirm `package.json` and the About screen show the same version.
- [ ] Keep `keys.json` and `keys.local.example.json` blank.
- [ ] Confirm no `keys.local.json`, OAuth secrets, private logs, or personal paths are staged.
- [ ] Read `HANDOFF.md` and update `docs/TEST_REPORT.md` with actual test results.
- [ ] Confirm Electron and electron-builder are current supported versions; upgrade after reviewing Electron release support policy.
- [ ] Run `npm install` and verify `src/renderer/vendor/skinview3d.bundle.min.js` is created.
- [ ] Run `npm run validate`.
- [ ] Run `npm start` on a supported desktop OS; inspect main and renderer console output.
- [ ] Test Arabic RTL and English LTR, navigation, onboarding, accounts, settings, and application restart.
- [ ] Test Vanilla, Fabric, Forge, NeoForge and Quilt install/launch with the required Java versions.
- [ ] Test import and export using real MRPack and ZIP modpacks.
- [ ] Test Modrinth search/install; test CurseForge only with a valid private key.
- [ ] Test offline skin file/URL, skin viewer, server ping, and join.
- [ ] Build the Windows NSIS installer on Windows.
- [ ] Build the Linux AppImage on Linux.
- [ ] Install and launch the produced installers on clean test accounts/machines.
- [ ] Verify uninstall behavior and that user instances/data are not unexpectedly removed.
- [ ] Update `CHANGELOG.md` and create/push the release tag.

## Current repository status at Phase 4 handoff

Static checks and Node tests passed in the preparation environment. The environment could not access npm registry and did not run `npm install`, Electron, Minecraft, or electron-builder. The above unchecked desktop and packaging items remain release blockers until run on real runners/devices. Do not call this a production-tested release before they pass.

/**
 * afterPack hook — ad-hoc code sign the .app before electron-builder
 * assembles the DMG.
 *
 * Without any signature, macOS Gatekeeper shows "damaged and can't be opened"
 * for apps downloaded from the internet (quarantine attribute).
 * Ad-hoc signing (`codesign --sign -`) gives the binary a local signature so
 * Gatekeeper shows "unidentified developer" instead, which users can bypass
 * via System Settings → Privacy & Security → Open Anyway.
 */

const { execSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (process.platform !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productName}.app`
  );

  try {
    execSync(
      `codesign --force --deep --sign - "${appPath}"`,
      { stdio: 'pipe' }
    );
    console.log('Ad-hoc signed:', appPath);
  } catch (err) {
    // Non-fatal — proceed without signing rather than failing the build
    console.warn('Ad-hoc signing skipped:', err.message);
  }
};

'use strict';
// Ad-hoc signs the macOS app after packaging. There's no Apple developer certificate, and Apple Silicon Macs
// refuse to run an app with no valid signature at all, so this is what lets "Open Anyway" work.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};

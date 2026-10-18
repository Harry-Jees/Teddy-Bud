const fs = require('node:fs');
const path = require('node:path');

const clientRoot = path.resolve(__dirname, '..');
const stageDirectory = path.resolve(clientRoot, '.desktop-package');
if (path.dirname(stageDirectory) !== clientRoot || path.basename(stageDirectory) !== '.desktop-package') {
  throw new Error('Refusing to prepare the desktop package outside the client workspace.');
}
const webBuildDirectory = path.resolve(clientRoot, '..', 'dist', 'web');
if (!fs.existsSync(path.join(webBuildDirectory, 'index.html'))) {
  throw new Error('Build the web app before preparing the desktop package.');
}

fs.rmSync(stageDirectory, { recursive: true, force: true });
fs.mkdirSync(stageDirectory, { recursive: true });
fs.cpSync(webBuildDirectory, path.join(stageDirectory, 'dist'), { recursive: true });
fs.cpSync(path.join(__dirname, 'main.cjs'), path.join(stageDirectory, 'main.cjs'));
fs.cpSync(path.join(__dirname, 'preload.cjs'), path.join(stageDirectory, 'preload.cjs'));
fs.cpSync(path.join(__dirname, 'icons'), path.join(stageDirectory, 'icons'), { recursive: true });
fs.cpSync(path.join(__dirname, 'electron-builder.yml'), path.join(stageDirectory, 'electron-builder.yml'));

const sourcePackage = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'));
const desktopPackage = {
  name: 'teddy-bud-desktop',
  productName: 'Teddy Bud',
  version: sourcePackage.version,
  description: 'A quiet place to be.',
  author: 'Teddy Bud',
  license: 'UNLICENSED',
  main: 'main.cjs',
};
fs.writeFileSync(path.join(stageDirectory, 'package.json'), `${JSON.stringify(desktopPackage, null, 2)}\n`);

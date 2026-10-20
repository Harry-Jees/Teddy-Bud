const { app, BrowserWindow, ipcMain, net, protocol, safeStorage, shell } = require('electron');
const { createCipheriv, createDecipheriv, randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'teddybud-app';
const APP_HOST = 'app';
const AUTH_SCHEME = 'teddybud:';
const GATEWAY_HOST = 'teddy-bud-browser-gateway.harryjees.workers.dev';
const APP_URL_PREFIX = `${APP_SCHEME}://${APP_HOST}/`;
const appLock = app.requestSingleInstanceLock();
let mainWindow;
let pendingAuthCallback = null;

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);

function authCallbackFrom(value) {
  if (typeof value !== 'string' || !value.startsWith(AUTH_SCHEME)) return null;
  try {
    const url = new URL(value);
    return url.protocol === AUTH_SCHEME && url.hostname === 'auth' && url.pathname === '/callback'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function deliverAuthCallback(value) {
  const callback = authCallbackFrom(value);
  if (!callback) return;
  if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:auth-callback', callback);
    mainWindow.show();
    mainWindow.focus();
  } else {
    pendingAuthCallback = callback;
  }
}

if (process.platform === 'darwin') {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    deliverAuthCallback(url);
  });
}

if (!appLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const callback = commandLine.map(authCallbackFrom).find(Boolean);
    if (callback) deliverAuthCallback(callback);
    else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function isTrustedRenderer(frame) {
  if (!frame) return false;
  try {
    const url = new URL(frame.url);
    return url.protocol === `${APP_SCHEME}:` && url.hostname === APP_HOST;
  } catch {
    return false;
  }
}

function encryptedSessionPath() {
  return path.join(app.getPath('userData'), 'account-session.bin');
}

function localDataKeyPath(keyName) {
  const digest = createHash('sha256').update(keyName).digest('hex');
  return path.join(app.getPath('userData'), 'local-data-keys', `${digest}.bin`);
}

function validLocalDataKeyName(value) {
  return typeof value === 'string' && value.length <= 512 && value.startsWith('teddy-bud:local-data:');
}

async function localDataKey(keyName, createIfMissing = true) {
  await requireSecureDesktopStorage();
  const destination = localDataKeyPath(keyName);
  try {
    const encrypted = await fs.readFile(destination);
    const { result } = await safeStorage.decryptStringAsync(encrypted);
    const key = Buffer.from(result, 'base64');
    if (key.length !== 32 || key.toString('base64') !== result) throw new Error('Invalid account data key.');
    return key;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
    if (!createIfMissing) throw new Error('The encryption key for this account is unavailable. The saved data cannot be opened.');
  }

  const key = randomBytes(32);
  const encrypted = await safeStorage.encryptStringAsync(key.toString('base64'));
  const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, encrypted, { mode: 0o600 });
  try {
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if (!error || error.code !== 'EEXIST') throw error;
  }
  return localDataKey(keyName, false);
}

async function requireSecureDesktopStorage() {
  if (!await safeStorage.isAsyncEncryptionAvailable()) {
    throw new Error('The operating-system secure storage is unavailable. Set up Windows Credential Manager, macOS Keychain, or a Linux keyring, then restart Teddy Bud.');
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    throw new Error('Teddy Bud needs a Linux Secret Service keyring (such as GNOME Keyring or KWallet) to save your sign-in securely.');
  }
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:open-external', async (event, value) => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    if (typeof value !== 'string' || value.length > 2_000) throw new Error('Invalid external link.');
    let url;
    try { url = new URL(value); } catch { throw new Error('Invalid external link.'); }
    const allowedHosts = new Set([
      GATEWAY_HOST,
      'teddybud.vercel.app',
      'findahelpline.com',
      'telemanas.mohfw.gov.in',
      '988lifeline.org',
      '988.ca',
    ]);
    if (url.protocol === 'https:' && allowedHosts.has(url.hostname) && !url.username && !url.password) {
      await shell.openExternal(url.toString());
      return;
    }
    if ((url.protocol === 'tel:' || url.protocol === 'sms:') && /^\+?[\d*#(). -]{2,40}$/.test(url.pathname)) {
      await shell.openExternal(url.toString());
      return;
    }
    throw new Error('This link cannot be opened from Teddy Bud.');
  });

  ipcMain.handle('desktop:load-session', async event => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    let encrypted;
    try {
      encrypted = await fs.readFile(encryptedSessionPath());
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw error;
    }
    await requireSecureDesktopStorage();
    const { result } = await safeStorage.decryptStringAsync(encrypted);
    return result;
  });

  ipcMain.handle('desktop:save-session', async (event, value) => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    if (typeof value !== 'string' || value.length > 16_384) throw new Error('Invalid account session.');
    JSON.parse(value);
    await requireSecureDesktopStorage();
    const encrypted = await safeStorage.encryptStringAsync(value);
    const destination = encryptedSessionPath();
    const temporary = `${destination}.tmp`;
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(temporary, encrypted, { mode: 0o600 });
    await fs.rename(temporary, destination);
  });

  ipcMain.handle('desktop:clear-session', async event => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    await fs.rm(encryptedSessionPath(), { force: true });
  });

  ipcMain.handle('desktop:encrypt-local-data', async (event, keyName, value) => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    if (!validLocalDataKeyName(keyName) || typeof value !== 'string' || value.length > 10_000_000) throw new Error('Invalid local data.');
    const key = await localDataKey(keyName);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(keyName, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  });

  ipcMain.handle('desktop:decrypt-local-data', async (event, keyName, value) => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    if (!validLocalDataKeyName(keyName) || typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error('Invalid encrypted local data.');
    }
    const encrypted = Buffer.from(value, 'base64');
    if (encrypted.toString('base64') !== value) throw new Error('Invalid encrypted local data.');
    if (encrypted.length < 12 + 16) throw new Error('Encrypted local data is incomplete.');
    const key = await localDataKey(keyName, false);
    const decipher = createDecipheriv('aes-256-gcm', key, encrypted.subarray(0, 12));
    decipher.setAAD(Buffer.from(keyName, 'utf8'));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8');
  });

  ipcMain.handle('desktop:decrypt-legacy-local-data', async (event, value) => {
    if (!isTrustedRenderer(event.senderFrame)) throw new Error('Untrusted desktop renderer.');
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new Error('Invalid encrypted local data.');
    }
    const encrypted = Buffer.from(value, 'base64');
    if (encrypted.toString('base64') !== value) throw new Error('Invalid encrypted local data.');
    await requireSecureDesktopStorage();
    const { result } = await safeStorage.decryptStringAsync(encrypted);
    return result;
  });
}

async function registerAppProtocol() {
  const distDirectory = path.join(app.getAppPath(), 'dist');
  await protocol.handle(APP_SCHEME, async request => {
    let relativePath;
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.hostname !== APP_HOST) return new Response('Not found', { status: 404 });
      relativePath = decodeURIComponent(requestUrl.pathname).replace(/^[/\\]+/, '') || 'index.html';
    } catch {
      return new Response('Invalid application URL', { status: 400 });
    }
    const resolvedPath = path.resolve(distDirectory, relativePath);
    if (!resolvedPath.startsWith(`${path.resolve(distDirectory)}${path.sep}`)) {
      return new Response('Not found', { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(resolvedPath).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 520,
    show: false,
    backgroundColor: '#F8F8F6',
    title: 'Teddy Bud',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow = window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL_PREFIX)) event.preventDefault();
  });
  window.webContents.once('did-finish-load', () => {
    window.show();
    if (pendingAuthCallback) {
      const callback = pendingAuthCallback;
      pendingAuthCallback = null;
      window.webContents.send('desktop:auth-callback', callback);
    }
  });

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' https://${GATEWAY_HOST}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.startsWith(APP_URL_PREFIX)) {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
    } else callback({ responseHeaders: details.responseHeaders });
  });
  window.loadURL(`${APP_URL_PREFIX}index.html`);
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
}

app.whenReady().then(async () => {
  if (!appLock) return;
  await registerAppProtocol();
  registerIpcHandlers();
  app.setAsDefaultProtocolClient('teddybud');
  createMainWindow();
  const initialCallback = process.argv.map(authCallbackFrom).find(Boolean);
  if (initialCallback) pendingAuthCallback = initialCallback;
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch(error => {
  console.error('Could not start Teddy Bud desktop:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

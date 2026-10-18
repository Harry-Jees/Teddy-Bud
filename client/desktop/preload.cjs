const { contextBridge, ipcRenderer } = require('electron');

const authCallbacks = [];
let authCallbackListener = null;

ipcRenderer.on('desktop:auth-callback', (_event, callbackUrl) => {
  if (typeof callbackUrl !== 'string') return;
  if (authCallbackListener) authCallbackListener(callbackUrl);
  else authCallbacks.push(callbackUrl);
});

contextBridge.exposeInMainWorld('teddyBudDesktop', Object.freeze({
  isDesktop: true,
  openExternal: url => ipcRenderer.invoke('desktop:open-external', url),
  loadSession: () => ipcRenderer.invoke('desktop:load-session'),
  saveSession: serializedSession => ipcRenderer.invoke('desktop:save-session', serializedSession),
  clearSession: () => ipcRenderer.invoke('desktop:clear-session'),
  onAuthCallback: listener => {
    authCallbackListener = listener;
    for (const callbackUrl of authCallbacks.splice(0)) listener(callbackUrl);
    return () => {
      if (authCallbackListener === listener) authCallbackListener = null;
    };
  },
}));

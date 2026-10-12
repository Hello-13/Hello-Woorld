'use strict';
// Bridge for the title bar only. The claude.ai page in the widget gets no preload and no access to the app.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  act: (name) => ipcRenderer.send('widget:action', String(name)),
  hello: () => ipcRenderer.invoke('widget:hello'),
  onState: (cb) => ipcRenderer.on('widget:state', (_e, s) => cb(s)),
});

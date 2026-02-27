import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  markFirstRunComplete: () => ipcRenderer.invoke('mark-first-run-complete'),
});

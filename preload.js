// ultraweb-client/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    sendControl: (command) => ipcRenderer.send("robot-control", command)
});
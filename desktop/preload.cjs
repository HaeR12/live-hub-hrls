const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("liveHub", {
  openChat: () => ipcRenderer.invoke("chat:open"),
  getChatPin: () => ipcRenderer.invoke("chat:get-pin"),
  setChatPin: (pinned) => ipcRenderer.invoke("chat:set-pin", pinned),
  getChatHistory: () => ipcRenderer.invoke("chat:get-history"),

  onEvent: (callback) => {
    if (typeof callback !== "function") return () => {};

    const listener = (_event, data) => callback(data);
    ipcRenderer.on("live-hub:event", listener);

    return () => {
      ipcRenderer.removeListener("live-hub:event", listener);
    };
  },

  onStats: (callback) => {
    if (typeof callback !== "function") return () => {};

    const listener = (_event, data) => callback(data);
    ipcRenderer.on("live-hub:stats", listener);

    return () => {
      ipcRenderer.removeListener("live-hub:stats", listener);
    };
  },
});

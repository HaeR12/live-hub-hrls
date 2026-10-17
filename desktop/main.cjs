const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { fork } = require("node:child_process");
const fs = require("node:fs/promises");

const projectRoot = path.resolve(__dirname, "..");

let mainWindow = null;
let chatWindow = null;
let chatPinned = false;
let backendProcess = null;
let backendStopping = false;
let quitting = false;

const MAX_CHAT_HISTORY = 1000;
const chatHistoryPath = path.join(app.getPath("userData"), "chat-history.json");

let chatHistory = [];
let chatHistoryReady = false;
let chatHistoryWriteQueue = Promise.resolve();

async function loadChatHistory() {
  try {
    const raw = await fs.readFile(chatHistoryPath, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      chatHistory = parsed
        .filter((event) => event && event.type === "CHAT")
        .slice(-MAX_CHAT_HISTORY);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[CHAT HISTORY] Gagal membaca riwayat:", error);
    }
    chatHistory = [];
  }

  chatHistoryReady = true;
  console.log(`[CHAT HISTORY] ${chatHistory.length} pesan berhasil dimuat.`);
}

function saveChatHistory() {
  const snapshot = JSON.stringify(chatHistory, null, 2);

  chatHistoryWriteQueue = chatHistoryWriteQueue
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(chatHistoryPath), {
        recursive: true,
      });

      const tempPath = `${chatHistoryPath}.tmp`;
      await fs.writeFile(tempPath, snapshot, "utf8");
      await fs.rename(tempPath, chatHistoryPath);
    })
    .catch((error) => {
      console.error("[CHAT HISTORY] Gagal menyimpan riwayat:", error);
    });

  return chatHistoryWriteQueue;
}

async function addChatToHistory(event) {
  await chatHistoryWriteQueue;

  if (!chatHistoryReady) {
    await loadChatHistory();
  }

  // Cegah duplikasi jika backend mengirim ulang event yang sama.
  const eventId = event.eventId ?? event.id;

  if (
    eventId &&
    chatHistory.some((item) => (item.eventId ?? item.id) === eventId)
  ) {
    return;
  }

  chatHistory.push(event);

  if (chatHistory.length > MAX_CHAT_HISTORY) {
    chatHistory = chatHistory.slice(-MAX_CHAT_HISTORY);
  }

  await saveChatHistory();
}

function sendToWindows(channel, payload) {
  for (const win of [mainWindow, chatWindow]) {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function stopBackend() {
  if (!backendProcess || backendStopping) return;

  backendStopping = true;
  const child = backendProcess;

  const forceKillTimer = setTimeout(() => {
    if (child.exitCode === null) {
      child.kill();
    }
  }, 3000);

  forceKillTimer.unref();

  child.once("exit", () => {
    clearTimeout(forceKillTimer);

    if (backendProcess === child) {
      backendProcess = null;
    }

    backendStopping = false;

    if (quitting) {
      app.quit();
    }
  });

  child.kill();
}

function startBackend() {
  if (backendProcess && backendProcess.exitCode === null) {
    return;
  }

  backendProcess = fork(path.join(projectRoot, "src", "index.ts"), [], {
    cwd: projectRoot,
    execPath: process.execPath,
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    env: process.env,
  });

  backendProcess.on("message", (message) => {
    if (!message || typeof message !== "object") return;

    if (
      message.type === "LIVE_HUB_EVENT" &&
      message.event &&
      typeof message.event === "object"
    ) {
      if (message.event.type === "CHAT") {
        void addChatToHistory(message.event);
      }

      sendToWindows("live-hub:event", message.event);
      return;
    }

    if (
      message.type === "LIVE_HUB_STATS" &&
      message.stats &&
      typeof message.stats === "object"
    ) {
      sendToWindows("live-hub:stats", message.stats);
    }
  });

  backendProcess.on("error", (error) => {
    console.error("[DESKTOP] Backend error:", error);
  });

  backendProcess.on("exit", (code, signal) => {
    console.log("[DESKTOP] Backend berhenti:", { code, signal });

    if (backendProcess && backendProcess.exitCode !== null) {
      backendProcess = null;
    }

    backendStopping = false;

    if (quitting) {
      app.quit();
    }
  });
}

function windowOptions(options) {
  return {
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    ...options,
  };
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }

  mainWindow = new BrowserWindow(
    windowOptions({
      width: 1200,
      height: 800,
      minWidth: 850,
      minHeight: 600,
      title: "Live Hub",
    }),
  );

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }

  chatWindow = new BrowserWindow(
    windowOptions({
      width: 420,
      height: 650,
      minWidth: 320,
      minHeight: 400,
      title: "Live Hub - Live Chat",
      alwaysOnTop: chatPinned,
    }),
  );

  chatWindow.loadFile(path.join(__dirname, "chat.html"));

  chatWindow.on("closed", () => {
    chatWindow = null;
  });
}

ipcMain.handle("chat:open", () => {
  createChatWindow();
  return { opened: true };
});

ipcMain.handle("chat:get-pin", () => ({
  pinned: chatPinned,
}));

ipcMain.handle("chat:set-pin", (_event, pinned) => {
  if (typeof pinned !== "boolean") {
    throw new TypeError("Status pin harus berupa boolean.");
  }

  chatPinned = pinned;

  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.setAlwaysOnTop(chatPinned);
  }

  return { pinned: chatPinned };
});

ipcMain.handle("chat:get-history", async () => {
  if (!chatHistoryReady) {
    await loadChatHistory();
  }
  return chatHistory.slice(-MAX_CHAT_HISTORY);
});

app.whenReady().then(async () => {
  await loadChatHistory();
  createWindow();
  startBackend();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", (event) => {
  if (!backendProcess || backendStopping) return;

  event.preventDefault();
  quitting = true;
  stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

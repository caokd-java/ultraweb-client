// ultraweb-client/main.cjs
const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { mouse, keyboard, Button, Point } = require("@nut-tree-fork/nut-js");

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Khi phát triển: Load từ localhost của Vite React
    win.loadURL("http://localhost:5173");
}

// Xử lý các sự kiện chuột/bàn phím từ React đẩy lên
ipcMain.on("robot-control", async (event, command) => {
    // Lấy độ phân giải thực tế của màn hình máy Host
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    try {
        if (command.type === "MOUSE_MOVE") {
            const targetX = command.x * width;
            const targetY = command.y * height;
            await mouse.setPosition(new Point(targetX, targetY));
        }

        if (command.type === "MOUSE_DOWN") {
            if (command.button === 0) await mouse.click(Button.LEFT);
            if (command.button === 2) await mouse.click(Button.RIGHT);
        }

        if (command.type === "KEY_DOWN") {
            await keyboard.type(command.key);
        }
    } catch (err) {
        console.log("Lỗi điều khiển hệ thống: ", err);
    }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
// ultraweb-client/main.cjs
const { app, BrowserWindow, ipcMain, screen, desktopCapturer, session } = require("electron");
const path = require("path");
const { mouse, keyboard, Button, Point } = require("@nut-tree-fork/nut-js");

// Kiểm tra xem ứng dụng đang chạy ở môi trường Dev hay đã Build
const isDev = !app.isPackaged;

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
    if (isDev) {
        // Khi lập trình: Load từ Vite dev server
        win.loadURL("http://localhost:5173");
    } else {
        // Khi đóng gói Production: Load trực tiếp từ file index.html trong thư mục build
        win.loadFile(path.join(__dirname, "dist/index.html"));
    }

    // 💡 KHẮC PHỤC LỖI CHIA SẺ MÀN HÌNH TRÊN ELECTRON
    // Cho phép React gọi getDisplayMedia và tự động chọn màn hình chính
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            // Tự động chọn nguồn màn hình đầu tiên (Màn hình chính)
            callback({ video: sources[0], audio: false });
        }).catch((error) => {
            console.error("Lỗi lấy danh sách màn hình Electron:", error);
        });
    });
}

// Xử lý các sự kiện chuột/bàn phím từ React đẩy lên
ipcMain.on("robot-control", async (event, command) => {

    console.log("📥 [Electron Main] Nhận lệnh điều khiển thực tế:", command);

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
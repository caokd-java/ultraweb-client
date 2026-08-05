import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { exec } from 'child_process';

// Plugin tự chế để khởi chạy Electron qua API
function launchElectronPlugin() {
  let isElectronRunning = false;

  return {
    name: 'launch-electron-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Kiểm tra nếu React gọi tới API kích hoạt Electron
        if (req.url === '/api/start-electron') {
          if (!isElectronRunning) {
            isElectronRunning = true;
            console.log('🚀 Đang khởi chạy Electron...');

            // Thực thi lệnh npm run electron
            exec('npm run electron', (error) => {
              isElectronRunning = false;
              if (error) {
                console.error('Lỗi khi chạy Electron:', error);
              }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'Electron is starting...' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'running', message: 'Electron is already running.' }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), launchElectronPlugin()],
});
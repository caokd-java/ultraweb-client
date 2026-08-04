// ultraweb-client/src/components/ScreenShare.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:8080"); // Địa chỉ Server

export default function ScreenShare() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState(null); // 'host' (máy bị đk) hoặc 'viewer' (máy đk)

  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  useEffect(() => {
    peerConnection.current = new RTCPeerConnection(rtcConfig);

    // Dành cho VIEW REICEIVER: Nhận luồng video từ Host gửi sang
    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    // Lắng nghe tín hiệu WebRTC từ server
    socket.on("offer", async (offer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async (answer) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async (candidate) => {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // DÀNH CHO HOST: Nhận lệnh điều khiển chuột từ Web thông qua Server trung gian
    socket.on("control-command", (command) => {
      // Nếu app đang chạy trong môi trường Electron, gửi lệnh này xuống Main Process xử lý phần cứng
      if (window.electronAPI) {
        window.electronAPI.sendControl(command);
      }
    });

    return () => socket.disconnect();
  }, [roomId]);

  // ================= MÁY CHIA SẺ MÀN HÌNH (HOST - CHẠY TRÊN ELECTRON) =================
  const startHost = async () => {
    setRole("host");
    socket.emit("join-room", roomId);

    try {
      // Quay màn hình máy tính
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } catch (err) {
      alert("Không thể chia sẻ màn hình: " + err.message);
    }
  };

  // ================= MÁY ĐIỀU KHIỂN (VIEWER - CHẠY TRÊN WEB TRÌNH DUYỆT) =================
  const startViewer = () => {
    setRole("viewer");
    socket.emit("join-room", roomId);
  };

  // Bắt các hành động chuột trên màn hình Stream và gửi đi
  const sendMouseAction = (e, type) => {
    if (role !== "viewer") return;
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;  // Tọa độ tỷ lệ % (0 -> 1)
    const y = (e.clientY - rect.top) / rect.height; // Tọa độ tỷ lệ % (0 -> 1)

    socket.emit("control-command", {
      roomId,
      command: { type, x, y, button: e.button, key: e.key }
    });
  };

  return (
      <div style={{ padding: "20px", textAlign: "center", fontFamily: "Arial" }}>
        <h1>UltraWeb - Điều khiển từ xa</h1>

        <div style={{ marginBottom: "20px" }}>
          <input
              placeholder="Nhập mã ID phòng..."
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              style={{ padding: "10px", marginRight: "10px", width: "200px" }}
          />
          <button onClick={startHost} style={{ padding: "10px 20px", background: "#2196F3", color: "white", border: "none", marginRight: "10px" }}>
            Phát Màn Hình (Cần App Electron)
          </button>
          <button onClick={startViewer} style={{ padding: "10px 20px", background: "#4CAF50", color: "white", border: "none" }}>
            Kết Nối Điều Khiển (Dùng Trên Web)
          </button>
        </div>

        {/* Hiển thị màn hình tương ứng */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {role === "host" && (
              <div>
                <h3>Bạn đang chia sẻ màn hình máy này...</h3>
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "400px", border: "2px solid #2196F3" }} />
              </div>
          )}

          {role === "viewer" && (
              <div onKeyDown={(e) => sendMouseAction(e, "KEY_DOWN")} tabIndex="0">
                <h3>Màn hình máy đối tác (Bấm chuột vào đây để điều khiển)</h3>
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    onMouseMove={(e) => sendMouseAction(e, "MOUSE_MOVE")}
                    onMouseDown={(e) => sendMouseAction(e, "MOUSE_DOWN")}
                    onContextMenu={(e) => e.preventDefault()} // Chặn chuột phải mặc định của web
                    style={{ width: "100%", maxWidth: "900px", border: "2px solid #4CAF50", cursor: "crosshair" }}
                />
              </div>
          )}
        </div>
      </div>
  );
}
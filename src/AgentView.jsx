import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const SIGNAL_SERVER = "http://localhost:8080";

export default function AgentView() {
    const [code, setCode] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    // Biến lưu trữ Stream toàn cục hoặc useRef
    const streamRef = useRef(null);

    useEffect(() => {
        socketRef.current = io(SIGNAL_SERVER);

        // Nếu chưa chạy trong môi trường Electron (đang mở bằng Chrome thuần)
        if (!window.electronAPI) {
            console.log("Đang kích hoạt Electron từ Web...");
            fetch('/api/start-electron')
                .then(res => res.json())
                .then(data => console.log("Kết quả gọi API:", data))
                .catch(err => console.error("Lỗi gọi API kích hoạt Electron:", err));
        }

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (peerRef.current) peerRef.current.close();
        };
    }, []);

    const handleStartShare = async () => {
        if (!code) return alert("Vui lòng nhập mã phòng!");

        const socket = socketRef.current;
        socket.emit("join-room", code);

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            streamRef.current = stream;

            const peer = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });
            peerRef.current = peer;

            // Add track màn hình vào PeerConnection
            stream.getTracks().forEach((track) => {
                console.log("➕ [Agent] Thêm track video vào PeerConnection:", track.kind);
                peer.addTrack(track, stream);
            });

            // Lắng nghe DataChannel điều khiển
            peer.ondatachannel = (event) => {
                const receiveChannel = event.channel;
                receiveChannel.onmessage = (e) => {
                    const command = JSON.parse(e.data);
                    console.log("Lệnh nhận từ controller:", command);
                    if (window.electronAPI) {
                        // window.electronAPI.executeControl(command);
                        handleReceiveCommand(command);
                    }
                };
            };

            // ✅ Khớp sự kiện 'ice-candidate' với Server
            peer.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log("➡️ [Agent] Gửi ICE Candidate sang Controller");
                    socket.emit("ice-candidate", { roomId: code, candidate: e.candidate });
                }
            };

            // ✅ KHỚP CÁC SỰ KIỆN VỚI SERVER
            // 1. Nhận Offer từ Controller -> Tạo Answer
            socket.on("offer", async (offer) => {
                console.log("📥 [Agent] Nhận được OFFER từ Controller!");
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                console.log("➡️ [Agent] Tạo và gửi ANSWER lại cho Controller");
                // Gửi Answer về
                socket.emit("answer", { roomId: code, answer });
            });

            // 2. Nhận ICE Candidate từ Controller
            socket.on("ice-candidate", async (candidate) => {
                if (candidate) {
                    console.log("📥 [Agent] Nhận được ICE Candidate từ Controller");
                    await peer.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });

            // 3. Nhận lệnh điều khiển trực tiếp qua Socket (nếu không dùng DataChannel)
            socket.on("control-command", (command) => {
                console.log("Lệnh điều khiển qua socket:", command);
                if (window.electronAPI) window.electronAPI.executeControl(command);
            });

            setIsSharing(true);
        } catch (err) {
            console.error("Lỗi chia sẻ màn hình:", err);
        }
    };

    const handleReceiveCommand = (command) => {
        console.log("🤖 [Agent] Nhận lệnh điều khiển:", command);

        // Gửi lệnh sang Main Process của Electron
        if (window.electronAPI && window.electronAPI.sendControl) {
            window.electronAPI.sendControl(command);
        } else {
            console.warn("Chưa có electronAPI!");
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Agent</h2>
            {!isSharing ? (
                <div>
                    <input
                        type="text"
                        placeholder="Mã phòng (VD: 123456)"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <button onClick={handleStartShare}>Bắt đầu chia sẻ</button>
                </div>
            ) : (
                <p style={{ color: 'green' }}>Đang chia sẻ cho phòng: {code}</p>
            )}
        </div>
    );
}
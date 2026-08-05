import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const SIGNAL_SERVER = "http://localhost:8080";

export default function ControllerView() {
    const [code, setCode] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const videoRef = useRef(null);
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const dataChannelRef = useRef(null);

    useEffect(() => {
        socketRef.current = io(SIGNAL_SERVER);

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            if (peerRef.current) peerRef.current.close();
        };
    }, []);

    const handleConnect = () => {
        if (!code) return alert("Vui lòng nhập mã phòng!");

        const socket = socketRef.current;
        socket.emit("join-room", code);

        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        peerRef.current = peer;

        // Tạo DataChannel
        const dataChannel = peer.createDataChannel("controlChannel");
        dataChannelRef.current = dataChannel;

        // 💡 QUAN TRỌNG: Báo cho WebRTC biết Controller muốn nhận Video từ Agent
        peer.addTransceiver('video', { direction: 'recvonly' });

        // Hiển thị stream khi nhận được track
        peer.ontrack = (event) => {
            console.log("🎬 [Controller] ĐÃ NHẬN ĐƯỢC STREAM VIDEO TỪ AGENT!", event.streams);
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
            setIsConnected(true);
        };

        // ✅ Khớp sự kiện 'ice-candidate' với Server
        peer.onicecandidate = (e) => {
            if (e.candidate) {
                console.log("➡️ [Controller] Gửi ICE Candidate sang Agent");
                socket.emit("ice-candidate", { roomId: code, candidate: e.candidate });
            }
        };

        // ✅ KHỚP CÁC SỰ KIỆN VỚI SERVER
        // 1. Nhận Answer từ Agent
        socket.on("answer", async (answer) => {
            console.log("📥 [Controller] Nhận được ANSWER phản hồi từ Agent!");
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
        });

        // 2. Nhận ICE Candidate từ Agent
        socket.on("ice-candidate", async (candidate) => {
            if (candidate) {
                console.log("📥 [Controller] Nhận được ICE Candidate từ Agent");
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        // 3. Tạo Offer và gửi đi
        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            console.log("➡️ [Controller] Đã tạo và gửi OFFER sang Agent");
            socket.emit("offer", { roomId: code, offer });
        });
    };

    const handleVideoClick = (e) => {
        const channel = dataChannelRef.current;
        const rect = videoRef.current.getBoundingClientRect();
        const xPercent = (e.clientX - rect.left) / rect.width;
        const yPercent = (e.clientY - rect.top) / rect.height;

        const command = { type: "click", xPercent, yPercent };

        // Ưu tiên gửi qua DataChannel (P2P nhanh hơn)
        if (channel && channel.readyState === "open") {
            channel.send(JSON.stringify(command));
        } else {
            // Dự phòng gửi qua Socket nhờ Server của bạn trung chuyển
            socketRef.current.emit("control-command", { roomId: code, command });
        }
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Máy Điều Khiển (Controller)</h2>
            <input
                type="text"
                placeholder="Mã phòng (VD: 123456)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
            />
            <button onClick={handleConnect}>Kết Nối</button>
            <br /><br />
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '80vw', height: '60vh', background: '#000' }}
                onClick={handleVideoClick}
            />
        </div>
    );
}
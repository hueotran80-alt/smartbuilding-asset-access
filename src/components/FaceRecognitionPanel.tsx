import { useEffect, useRef, useState } from "react";
import { analyzeFaceFrame } from "../services/face/faceRecognition";

type Props = { video: HTMLVideoElement | null };

export default function FaceRecognitionPanel({ video }: Props) {
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState("Đang chờ camera...");
  const [faces, setFaces] = useState(0);
  const [embeddingReady, setEmbeddingReady] = useState(false);

  useEffect(() => {
    if (!video) return;
    let active = true;

    const run = async () => {
      if (!active || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      try {
        const result = await analyzeFaceFrame(video, []);
        if (!active) return;
        setFaces(result.faces.length);
        setEmbeddingReady(Boolean(result.embedding?.length === 128));
        if (result.faces.length === 0) setStatus("Không phát hiện khuôn mặt");
        else if (result.faces.length > 1) setStatus("Phát hiện nhiều khuôn mặt — cần đúng 1 người");
        else if (result.embedding?.length === 128) setStatus("Khuôn mặt + embedding 128D đã sẵn sàng");
        else setStatus("Đã phát hiện khuôn mặt, đang xử lý embedding...");
      } catch (error) {
        console.error("[Face AI]", error);
        if (active) setStatus("Lỗi xử lý Face AI — xem Console");
      }
    };

    void run();
    timerRef.current = window.setInterval(() => void run(), 1000);

    return () => {
      active = false;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [video]);

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,.45)", color: "#fff" }}>
      <b>Face AI</b>
      <div style={{ marginTop: 6 }}>{status}</div>
      <small>Khuôn mặt: {faces} · Embedding 128D: {embeddingReady ? "OK" : "chưa"}</small>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, CircleAlert } from "lucide-react";
import { analyzeFaceFrame, isFacePoseValidForEnrollment } from "../../services/face/faceRecognition";
import {
  getActiveFaceEnrollmentForCamera,
  getEnrollmentSampleAngles,
  saveFaceEmbedding,
  setEnrollmentStatus,
  type FaceAngle,
  type FaceEnrollmentSession,
} from "../../services/face/faceEnrollmentService";

type Props = {
  cameraId: string;
  video: HTMLVideoElement | null;
};

const ANGLES: FaceAngle[] = ["STRAIGHT", "LEFT", "RIGHT"];

const angleLabel: Record<FaceAngle, string> = {
  STRAIGHT: "Chính diện",
  LEFT: "Quay trái",
  RIGHT: "Quay phải",
};

export default function FaceEnrollment({ cameraId, video }: Props) {
  const [session, setSession] = useState<FaceEnrollmentSession | null>(null);
  const [samples, setSamples] = useState<FaceAngle[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const captureRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const capturingRef = useRef(false);
  const samplesRef = useRef<FaceAngle[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  const nextAngle = useMemo(
    () => ANGLES.find((angle) => !samples.includes(angle)) ?? null,
    [samples]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const activeSession = await getActiveFaceEnrollmentForCamera(cameraId);
        if (!active) return;
        setSession(activeSession);
        if (!activeSession) {
          sessionIdRef.current = null;
          samplesRef.current = [];
          setSamples([]);
          return;
        }
        if (sessionIdRef.current !== activeSession.id) {
          sessionIdRef.current = activeSession.id;
          const loadedSamples = await getEnrollmentSampleAngles(activeSession.id);
          samplesRef.current = loadedSamples;
          setSamples(loadedSamples);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không thể tải phiên đăng ký.");
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cameraId]);

  useEffect(() => {
    if (session?.status === "PENDING" && video) {
      void setEnrollmentStatus(session.id, "CAPTURING")
        .then(() => setSession((current) => current ? { ...current, status: "CAPTURING" } : current))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Không thể bắt đầu phiên.")
        );
    }
  }, [session?.id, session?.status, video]);

  const capture = async () => {
    const currentSamples = samplesRef.current;
    const currentNextAngle = ANGLES.find((angle) => !currentSamples.includes(angle)) ?? null;
    if (!session || !currentNextAngle || !video || capturingRef.current) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera chưa sẵn sàng. Đang chờ hình ảnh...");
      return;
    }

    capturingRef.current = true;
    setCapturing(true);
    setError(null);
    setMessage(null);

    try {
      const embeddings: number[][] = [];

      for (let index = 0; index < 3; index++) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, 180));

        const result = await analyzeFaceFrame(video);
        if (result.faces.length !== 1 || !result.embedding || !result.quality) {
          throw new Error(
            result.faces.length === 0
              ? "Không phát hiện khuôn mặt. Hãy đứng trước camera."
              : "Cần đúng 1 khuôn mặt rõ nét trong khung hình.",
          );
        }

        if (!isFacePoseValidForEnrollment(result.quality, currentNextAngle)) {
          const poseText =
            result.quality.pose === "UNKNOWN"
              ? "đúng vị trí và không nghiêng đầu quá nhiều"
              : "đúng góc " + angleLabel[currentNextAngle];
          throw new Error("Hãy giữ " + poseText + " để hệ thống lấy mẫu chính xác.");
        }

        embeddings.push(result.embedding);
      }

      const averaged = new Array(128).fill(0) as number[];
      for (const embedding of embeddings) {
        for (let i = 0; i < 128; i++) averaged[i] += embedding[i] / embeddings.length;
      }
      const norm = Math.hypot(...averaged);
      if (!Number.isFinite(norm) || norm <= 1e-12) {
        throw new Error("Không tạo được embedding ổn định.");
      }
      const stableEmbedding = averaged.map((value) => value / norm);

      await saveFaceEmbedding({
        occupantId: session.occupantId,
        cameraId: session.cameraId,
        enrollmentSessionId: session.id,
        angle: currentNextAngle,
        embedding: stableEmbedding,
      });

      const nextSamples = [...samplesRef.current, currentNextAngle];
      samplesRef.current = nextSamples;
      setSamples(nextSamples);

      if (nextSamples.length === 3) {
        await setEnrollmentStatus(session.id, "COMPLETED");
        setSession({ ...session, status: "COMPLETED" });
        setMessage("Đã chụp đủ 3 mẫu chất lượng cao. Chờ quản trị viên duyệt.");
      } else {
        setMessage("Đã lưu 3 frame cho mẫu " + angleLabel[currentNextAngle] + ".");
      }
    } catch (err) {
      console.error("[FaceEnrollment] Capture failed:", err);
      setError(
        err instanceof Error ? err.message : "Không thể lưu mẫu khuôn mặt.",
      );
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  };

  captureRef.current = capture;

  useEffect(() => {
    if (!session || !video || (session.status !== "PENDING" && session.status !== "CAPTURING")) {
      return;
    }

    let active = true;
    void captureRef.current();
    const timer = window.setInterval(() => {
      if (active) void captureRef.current();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session?.id, session?.status, video]);

  if (!session) {
    return (
      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>Đăng ký khuôn mặt</h3>
            <p>Camera đang chờ quản trị viên tạo phiên đăng ký.</p>
          </div>
          <Camera size={22} />
        </div>
        <div className="info-box">
          <CircleAlert size={19} />
          <div>
            <b>Chưa có phiên</b>
            <span>Hãy tạo phiên từ màn hình quản trị phòng.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-head">
        <div>
          <h3>Đăng ký khuôn mặt · 3 mẫu</h3>
          <p>Chụp chính diện, quay trái, rồi quay phải.</p>
        </div>
        <span className="live-tag">
          <span />
          {session.status}
        </span>
      </div>

      <div className="realtime-grid">
        {ANGLES.map((angle) => (
          <div className="state-item" key={angle}>
            <span>{angleLabel[angle]}</span>
            <b>
              {samples.includes(angle) ? "Đã chụp ✓" : "Chưa chụp"}
            </b>
          </div>
        ))}
      </div>

      {nextAngle && session.status !== "COMPLETED" && (
        <div className="info-box">
          <Camera size={19} />
          <div>
            <b>Camera tự chụp tuần tự 3 mẫu</b>
            <span>
              Hệ thống chụp xong từng mẫu rồi mới chuyển sang góc tiếp theo: {ANGLES.map((angle) => angleLabel[angle]).join(" → ")}.
              Không cần bấm nút chụp.
            </span>
          </div>
        </div>
      )}

      {message && (
        <div className="info-box">
          <CheckCircle2 size={19} />
          <div>
            <b>Face AI</b>
            <span>{message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="info-box">
          <CircleAlert size={19} />
          <div>
            <b>Không thể chụp mẫu</b>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

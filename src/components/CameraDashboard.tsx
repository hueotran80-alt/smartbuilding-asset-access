import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  CameraOff,
  CircleAlert,
  CircleCheck,
  MonitorUp,
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";

import {
  analyzeFaceFrame,
} from "../services/face/faceRecognition";
import { recognizeFace } from "../services/face/faceAccessService";
import FaceEnrollment from "./face/FaceEnrollment";

import {
  getCameraIceServers,
  createCameraSignalingChannel,
  ensureMyCamera,
  getMyCamera,
  markCameraOffline,
  subscribeMyCamera,
  updateCameraStatus,
  type CameraDevice,
  type CameraSignal,
} from "../lib/cameraService";
import {
  openAppSettings,
  requestCameraPermission,
} from "../lib/nativePermissions";

type Props = {
  userId: string;
  username: string;
};

const FACE_DWELL_MS = 600;
const FACE_REQUIRED_MATCHES = 2;
const FACE_OPEN_PREPARE_MS = 0;
const FACE_EMPTY_CONFIRMATIONS = 3;
const FACE_AUDIO_COOLDOWN_MS = 3000;

type FaceVisionState = {
  phase: "IDLE" | "DETECTING" | "QUALITY_REJECT" | "MATCHING" | "MATCHED" | "NO_MATCH" | "ERROR";
  face: { x: number; y: number; w: number; h: number; score: number } | null;
  faceCount: number;
  similarity: number | null;
  threshold: number | null;
  matchedName: string | null;
  consecutive: number;
  dwellMs: number;
  qualityText?: string;
  message: string;
};

function faceBoxPercent(
  face: FaceVisionState["face"],
  video: HTMLVideoElement | null,
) {
  if (!face || !video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  const frame = 640;
  const scale = Math.min(frame / video.videoWidth, frame / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  const offsetX = (frame - drawWidth) / 2;
  const offsetY = (frame - drawHeight) / 2;
  const x = (face.x - offsetX) / scale;
  const y = (face.y - offsetY) / scale;
  const width = face.w / scale;
  const height = face.h / scale;

  return {
    left: String(Math.max(0, (x / video.videoWidth) * 100)) + "%",
    top: String(Math.max(0, (y / video.videoHeight) * 100)) + "%",
    width: String(Math.min(100, (width / video.videoWidth) * 100)) + "%",
    height: String(Math.min(100, (height / video.videoHeight) * 100)) + "%",
  };
}

function faceStatusColor(phase: FaceVisionState["phase"]) {
  if (phase === "MATCHED") return "#22c55e";
  if (phase === "NO_MATCH" || phase === "ERROR") return "#ef4444";
  if (phase === "QUALITY_REJECT") return "#f59e0b";
  if (phase === "MATCHING" || phase === "DETECTING") return "#fbbf24";
  return "#60a5fa";
}

export default function CameraDashboard({
  userId,
  username,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );
  const [videoElement, setVideoElement] =
    useState<HTMLVideoElement | null>(null);

  const [faceVision, setFaceVision] = useState<FaceVisionState>({
    phase: "IDLE",
    face: null,
    faceCount: 0,
    similarity: null,
    threshold: null,
    matchedName: null,
    consecutive: 0,
    dwellMs: 0,
    message: "Đang chờ camera...",
  });

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const heartbeatRef =
    useRef<number | null>(null);

  const visionIntervalRef =
    useRef<number | null>(null);

  const lastFaceOpenAtRef =
    useRef(0);

  // Sau khi đã mở cửa bằng Face AI, khóa không cho tạo lệnh mới
  // cho đến khi camera xác nhận không còn người trước cửa.
  const faceAccessLatchedRef =
    useRef(false);

  const faceEmptyCountRef =
    useRef(0);

  const faceMatchOccupantRef =
    useRef<string | null>(null);

  const faceMatchCountRef =
    useRef(0);

  const faceMatchStartedAtRef =
    useRef(0);

  const faceOpenPrepareStartedAtRef =
    useRef(0);

  const faceAudioLastAtRef =
    useRef(0);

  const announceFaceResult = useCallback((message: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const now = Date.now();
    if (now - faceAudioLastAtRef.current < FACE_AUDIO_COOLDOWN_MS) {
      return;
    }

    faceAudioLastAtRef.current = now;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "vi-VN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const faceVisionRunningRef =
    useRef(false);

const peersRef =
  useRef<
    Map<string, RTCPeerConnection>
  >(new Map());

const pendingViewerIceRef =
  useRef<
    Map<string, RTCIceCandidateInit[]>
  >(new Map());

const signalingRef =
  useRef<
    Awaited<
      ReturnType<
        typeof createCameraSignalingChannel
      >
    > | null
  >(null);

  const [camera, setCamera] =
    useState<CameraDevice | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [starting, setStarting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [permissionDenied, setPermissionDenied] =
    useState(false);

  const liveContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLiveFullscreen, setIsLiveFullscreen] = useState(false);

  const stopLocalStream =
    useCallback(() => {
      const stream =
        streamRef.current;

      if (!stream) {
        return;
      }

      stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject =
          null;
      }
    }, []);

  const stopCamera =
    useCallback(async () => {
      stopLocalStream();

      if (heartbeatRef.current) {
        window.clearInterval(
          heartbeatRef.current
        );

        heartbeatRef.current =
          null;
      }

      if (camera?.id) {
        try {
          await markCameraOffline(
            camera.id
          );
        } catch (err) {
          console.error(
            "Không thể cập nhật camera offline:",
            err
          );
        }
      }

      setCamera(
        (previous) =>
          previous
            ? {
                ...previous,
                online: false,
                streaming: false,
              }
            : previous
      );
    }, [
      camera?.id,
      stopLocalStream,
    ]);

  const startCamera =
    useCallback(async () => {
      setStarting(true);
      setError(null);
      setPermissionDenied(false);

      try {
        const cameraPermission = await requestCameraPermission();

        if (!cameraPermission.granted) {
          setPermissionDenied(true);
          setError(
            "Ứng dụng cần quyền Camera để phát trực tiếp và nhận diện khuôn mặt. Hãy cấp quyền trong Cài đặt Android."
          );
          return;
        }

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices
            .getUserMedia
        ) {
          throw new Error(
            "Trình duyệt không hỗ trợ truy cập camera."
          );
        }

        const mediaStream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                facingMode: "user",
                width: 640,
                height: 480,
              },
              audio: false,
            }
          );

        streamRef.current =
          mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject =
            mediaStream;

          await videoRef.current.play();
        }

        const currentCamera =
          camera ??
          (await ensureMyCamera(
            userId
          ));

        setCamera(
          currentCamera
        );

        await updateCameraStatus(
          currentCamera.id,
          {
            online: true,
            streaming: true,
            lastSeen:
              new Date().toISOString(),
          }
        );

        setCamera(
          (previous) =>
            previous
              ? {
                  ...previous,
                  online: true,
                  streaming: true,
                  lastSeen:
                    new Date().toISOString(),
                }
              : previous
        );

        heartbeatRef.current =
          window.setInterval(
            () => {
              void updateCameraStatus(
                currentCamera.id,
                {
                  online: true,
                  streaming: true,
                  lastSeen:
                    new Date().toISOString(),
                }
              );
            },
            10_000
          );
      } catch (err) {
        console.error(
          "Không thể khởi động camera:",
          err
        );

        stopLocalStream();

        if (
          err instanceof DOMException &&
          (err.name ===
            "NotAllowedError" ||
            err.name ===
              "PermissionDeniedError")
        ) {
          setPermissionDenied(
            true
          );

          setError(
            "Bạn chưa cấp quyền sử dụng camera cho trình duyệt."
          );
        } else if (
          err instanceof DOMException &&
          err.name ===
            "NotFoundError"
        ) {
          setError(
            "Không tìm thấy camera trên thiết bị này."
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể khởi động camera."
          );
        }
      } finally {
        setStarting(false);
      }
    }, [
      camera,
      stopLocalStream,
      userId,
    ]);

  useEffect(() => {
    let active = true;

    const loadCamera =
      async () => {
        try {
          const current =
            await getMyCamera(
              userId
            );

          if (!active) {
            return;
          }

          if (current) {
            setCamera(current);

            const unsubscribe =
              subscribeMyCamera(
                current.id,
                (next) => {
                  if (active) {
                    setCamera(
                      next
                    );
                  }
                }
              );

            return unsubscribe;
          }

          const created =
            await ensureMyCamera(
              userId
            );

          if (!active) {
            return;
          }

          setCamera(created);

          return subscribeMyCamera(
            created.id,
            (next) => {
              if (active) {
                setCamera(
                  next
                );
              }
            }
          );
        } catch (err) {
          console.error(
            "Không tải được camera:",
            err
          );

          if (active) {
            setError(
              err instanceof Error
                ? err.message
                : "Không thể tải camera."
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    let cleanup:
      | (() => void)
      | undefined;

    void loadCamera().then(
      (unsubscribe) => {
        cleanup =
          unsubscribe;
      }
    );

    return () => {
      active = false;

      cleanup?.();

      stopLocalStream();

      if (
        heartbeatRef.current
      ) {
        window.clearInterval(
          heartbeatRef.current
        );
      }

      heartbeatRef.current =
        null;
    };
  }, [
    stopLocalStream,
    userId,
  ]);

  // ==================================================
  // CAMERA VISION + FACE AI
  // ==================================================

  useEffect(() => {
    if (!camera?.streaming || !streamRef.current) {
      return;
    }

    let active = true;

    const resetMatchConsensus = () => {
      faceMatchOccupantRef.current = null;
      faceMatchCountRef.current = 0;
      faceMatchStartedAtRef.current = 0;
      faceOpenPrepareStartedAtRef.current = 0;
    };

    const runVision = async () => {
      if (faceVisionRunningRef.current) return;

      const video = videoRef.current;

      if (
        !active ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        return;
      }

      faceVisionRunningRef.current = true;

      try {
        const result = await analyzeFaceFrame(video);
        const faceCount = result.faces.length;
        const detectedFace = faceCount === 1 ? result.faces[0] : null;
        const detectedAt = new Date().toISOString();

        setFaceVision((current) => ({
          ...current,
          phase:
            faceCount === 0
              ? "DETECTING"
              : result.quality?.acceptable
                ? "MATCHING"
                : "QUALITY_REJECT",
          face: detectedFace
            ? {
                x: detectedFace.x,
                y: detectedFace.y,
                w: detectedFace.w,
                h: detectedFace.h,
                score: detectedFace.score,
              }
            : null,
          faceCount,
          similarity: null,
          threshold: null,
          matchedName: null,
          consecutive: 0,
          dwellMs: 0,
          qualityText: result.quality
            ? `Score ${result.quality.detectionScore.toFixed(2)} · mắt ${result.quality.eyeDistance.toFixed(0)}px · tư thế ${result.quality.pose}`
            : undefined,
          message:
            faceCount === 0
              ? "Không phát hiện khuôn mặt"
              : result.quality?.acceptable
                ? "Đã phát hiện mặt · đang tạo embedding"
                : "Đã thấy mặt nhưng chất lượng chưa đạt",
        }));

        console.log(
          `[Face AI] Faces: ${faceCount} | Embedding: ${result.embedding?.length ?? 0}D | Quality: ${result.quality?.acceptable ? "OK" : "REJECT"}`,
          result.quality,
        );

        if (camera?.id) {
          await updateCameraStatus(camera.id, {
            personDetected: faceCount > 0,
            personCount: faceCount,
            detectionConfidence:
              faceCount > 0 ? result.faces[0]?.score ?? null : null,
            lastDetectionAt:
              faceCount > 0 ? detectedAt : null,
            detectionExpiresAt:
              faceCount > 0
                ? new Date(Date.now() + 5000).toISOString()
                : null,
          });
        }

        // Một lần mở cửa thành công sẽ khóa toàn bộ Face Access cho đến khi
        // camera xác nhận người đã rời khỏi vùng quan sát. Cần 3 lần liên tiếp
        // không thấy mặt để chống frame lỗi và chống spam lệnh mở.
        if (faceCount === 0) {
          faceEmptyCountRef.current += 1;
        } else {
          faceEmptyCountRef.current = 0;
        }

        if (faceAccessLatchedRef.current) {
          if (faceEmptyCountRef.current >= FACE_EMPTY_CONFIRMATIONS) {
            faceAccessLatchedRef.current = false;
            faceEmptyCountRef.current = 0;
            lastFaceOpenAtRef.current = 0;
            resetMatchConsensus();
            setFaceVision((current) => ({
              ...current,
              phase: "DETECTING",
              similarity: null,
              threshold: null,
              matchedName: null,
              consecutive: 0,
              dwellMs: 0,
              message: "Camera đã trống · sẵn sàng nhận diện người tiếp theo",
              qualityText: undefined,
            }));
            return;
          }

          resetMatchConsensus();
          setFaceVision((current) => ({
            ...current,
            phase: "MATCHED",
            similarity: null,
            threshold: null,
            consecutive: 0,
            dwellMs: FACE_DWELL_MS,
            message: "Đã mở cửa · chờ người rời khỏi camera",
            qualityText: "Chưa cho phép mở lại trong cùng lượt đứng trước camera · cần 3 lần liên tiếp không thấy mặt",
          }));
          return;
        }

        if (
          !camera?.id ||
          !result.embedding ||
          faceCount !== 1 ||
          !result.quality?.acceptable
        ) {
          resetMatchConsensus();
          setFaceVision((current) => ({
            ...current,
            phase: faceCount === 0 ? "DETECTING" : "QUALITY_REJECT",
            similarity: null,
            threshold: null,
            matchedName: null,
            consecutive: 0,
            dwellMs: 0,
            message:
              faceCount === 0
                ? "Không thấy khuôn mặt"
                : "Khuôn mặt chưa đạt điều kiện nhận diện",
          }));
          return;
        }

        setFaceVision((current) => ({
          ...current,
          phase: "MATCHING",
          message: "Đang đối chiếu với dữ liệu đã đăng ký...",
        }));

        const recognition = await recognizeFace(
          camera.id,
          result.embedding,
          false,
        );

        if (!recognition.matched || !recognition.occupant_id) {
          resetMatchConsensus();
          setFaceVision((current) => ({
            ...current,
            phase: "NO_MATCH",
            similarity: recognition.similarity ?? null,
            threshold: recognition.threshold ?? null,
            matchedName: null,
            consecutive: 0,
            dwellMs: 0,
            qualityText: recognition.error ?? undefined,
            message: "Chưa khớp khuôn mặt đã đăng ký",
          }));
          console.log(
            "[Face AI] No match | similarity:",
            recognition.similarity?.toFixed(3),
            "| threshold:",
            recognition.threshold,
          );
          announceFaceResult("Không nhận diện được khuôn mặt.");
          return;
        }

        const now = Date.now();
        if (faceMatchOccupantRef.current === recognition.occupant_id) {
          faceMatchCountRef.current += 1;
        } else {
          faceMatchOccupantRef.current = recognition.occupant_id;
          faceMatchCountRef.current = 1;
          faceMatchStartedAtRef.current = now;
        }

        const dwellMs = Math.max(
          0,
          now - faceMatchStartedAtRef.current,
        );
        const stableMatch =
          faceMatchCountRef.current >= FACE_REQUIRED_MATCHES;

        setFaceVision((current) => ({
          ...current,
          phase: dwellMs >= FACE_DWELL_MS && stableMatch ? "MATCHED" : "MATCHING",
          similarity: recognition.similarity ?? null,
          threshold: recognition.threshold ?? null,
          matchedName:
            faceMatchCountRef.current >= 3
              ? recognition.matched_name ?? recognition.occupant_id ?? null
              : null,
          consecutive: faceMatchCountRef.current,
          dwellMs,
          qualityText:
            !stableMatch
              ? "Đang xác nhận ổn định " +
                faceMatchCountRef.current +
                "/" +
                FACE_REQUIRED_MATCHES +
                " lần"
              : dwellMs < FACE_DWELL_MS
                ? "Đã xác nhận sơ bộ · giữ khuôn mặt thêm " +
                  ((FACE_DWELL_MS - dwellMs) / 1000).toFixed(1) +
                  "s"
                : undefined,
          message:
            !stableMatch
              ? "Đang xác nhận danh tính · chưa cho phép mở cửa"
              : dwellMs < FACE_DWELL_MS
                ? "Đã nhận diện ổn định · đang chờ đủ thời gian xác nhận"
                : "Đã xác nhận đúng người · bắt đầu chuẩn bị mở cửa",
        }));

        console.log(
          "[Face AI] Server match:",
          recognition.occupant_id,
          recognition.matched_name,
          "similarity:",
          (recognition.similarity ?? 0).toFixed(3),
          "threshold:",
          recognition.threshold,
          "dwell_ms:",
          dwellMs,
          "consecutive:",
          faceMatchCountRef.current,
        );

        if (
          !stableMatch ||
          dwellMs < FACE_DWELL_MS ||
          Date.now() - lastFaceOpenAtRef.current <= 8000
        ) {
          return;
        }

        const access = await recognizeFace(
          camera.id,
          result.embedding,
          true,
        );

        if (access.matched && !access.command_id) {
          // Server-side safety gate đã chặn lệnh lặp hoặc cửa đang mở.
          // Latch ngay tại phiên Face AI và chờ camera xác nhận người rời đi.
          faceAccessLatchedRef.current = true;
          faceEmptyCountRef.current = 0;
          setFaceVision((current) => ({
            ...current,
            phase: "MATCHED",
            message: "Face AI đã bị khóa chống lặp · chờ người rời khỏi camera",
            qualityText: access.error ?? "Không gửi thêm lệnh OPEN trong lượt hiện tại",
          }));
          resetMatchConsensus();
          return;
        }

        if (access.matched && access.command_id) {
          lastFaceOpenAtRef.current = Date.now();
          faceAccessLatchedRef.current = true;
          faceEmptyCountRef.current = 0;

          setFaceVision((current) => ({
            ...current,
            phase: "MATCHED",
            similarity: access.similarity ?? current.similarity,
            threshold: access.threshold ?? current.threshold,
            consecutive: faceMatchCountRef.current,
            dwellMs: FACE_DWELL_MS,
            matchedName:
              access.matched_name ??
              recognition.matched_name ??
              current.matchedName,
            message: "Đã tạo lệnh mở cửa",
            qualityText:
              "Lệnh FACE đã vào hàng đợi điều khiển cửa",
          }));
          announceFaceResult("Đã nhận diện thành công. Cửa đang mở.");

          resetMatchConsensus();

          console.log(
            "[Face AI] FACE access command created:",
            access.command_id,
            "occupant:",
            access.occupant_id,
            "similarity:",
            (access.similarity ?? 0).toFixed(3),
          );
        }
      } catch (error) {
        resetMatchConsensus();
        setFaceVision((current) => ({
          ...current,
          phase: "ERROR",
          consecutive: 0,
          dwellMs: 0,
          message:
            error instanceof Error
              ? `Lỗi Face AI: ${error.message}`
              : "Lỗi Face AI không xác định",
        }));
        console.warn("[Face AI] Vision/matching error:", error);
      } finally {
        faceVisionRunningRef.current = false;
      }
    };

    visionIntervalRef.current = window.setInterval(() => {
      void runVision();
    }, 700);

    void runVision();

    return () => {
      active = false;

      if (visionIntervalRef.current) {
        window.clearInterval(visionIntervalRef.current);
        visionIntervalRef.current = null;
      }

      faceVisionRunningRef.current = false;
      faceAccessLatchedRef.current = false;
      faceEmptyCountRef.current = 0;
      resetMatchConsensus();
      setFaceVision({
        phase: "IDLE",
        face: null,
        faceCount: 0,
        similarity: null,
        threshold: null,
        matchedName: null,
        consecutive: 0,
        dwellMs: 0,
        message: "Đang chờ camera...",
      });
    };
  }, [camera?.streaming, announceFaceResult]);

  // ==================================================
  // WEBRTC SIGNALING
  // ==================================================

  useEffect(() => {
    if (
      !camera?.streamId ||
      !camera.streaming ||
      !streamRef.current
    ) {
      return;
    }

    let active = true;

    const startSignaling = async () => {
      const signaling =
        await createCameraSignalingChannel(
          camera.streamId!,
          async (signal: CameraSignal) => {
            if (!active) {
              return;
            }

            if (
              signal.type ===
              "viewer-request"
            ) {
              const viewerId =
                signal.viewerId;

              const existing =
                peersRef.current.get(
                  viewerId
                );

              existing?.close();

              const iceServers = await getCameraIceServers();
              const peer =
                new RTCPeerConnection({
                  iceServers,
                });

              peersRef.current.set(
                viewerId,
                peer
              );

              streamRef.current
                ?.getTracks()
                .forEach((track) => {
                  peer.addTrack(
                    track,
                    streamRef.current!
                  );
                });

              peer.onicecandidate =
                (event) => {
                  if (
                    event.candidate
                  ) {
                    void signaling.send({
                      type:
                        "ice-candidate",
                      targetId:
                        viewerId,
                      candidate:
                        event.candidate.toJSON(),
                    });
                  }
                };

              peer.onconnectionstatechange = () => {
                const state = peer.connectionState;

                if (
                  state === "failed" ||
                  state === "closed" ||
                  state === "disconnected"
                ) {
                  if (peersRef.current.get(viewerId) === peer) {
                    peersRef.current.delete(viewerId);
                  }
                  pendingViewerIceRef.current.delete(viewerId);
                  peer.close();
                }
              };

              const offer =
                await peer.createOffer();

              await peer.setLocalDescription(
                offer
              );

              await signaling.send({
                type: "offer",
                targetId:
                  viewerId,
                offer,
              });
            }

            if (
              signal.type ===
              "answer"
            ) {
              const peer =
                peersRef.current.get(
                  signal.targetId
                );

              if (!peer) {
                return;
              }

              await peer.setRemoteDescription(
                signal.answer
              );

              const pending =
                pendingViewerIceRef.current.get(
                  signal.targetId
                ) ?? [];

              pendingViewerIceRef.current.delete(
                signal.targetId
              );

              for (const candidate of pending) {
                try {
                  await peer.addIceCandidate(
                    candidate
                  );
                } catch (err) {
                  console.error(
                    "Không thể thêm ICE candidate đã chờ:",
                    err
                  );
                }
              }
            }

            if (
              signal.type ===
              "ice-candidate"
            ) {
              const peer =
                peersRef.current.get(
                  signal.targetId
                );

              if (!peer) {
                return;
              }

              if (!peer.remoteDescription) {
                const pending =
                  pendingViewerIceRef.current.get(
                    signal.targetId
                  ) ?? [];

                pending.push(signal.candidate);
                pendingViewerIceRef.current.set(
                  signal.targetId,
                  pending
                );
              } else {
                try {
                  await peer.addIceCandidate(
                    signal.candidate
                  );
                } catch (err) {
                  console.error(
                    "Không thể thêm ICE candidate:",
                    err
                  );
                }
              }
            }

            if (
              signal.type ===
              "viewer-stop"
            ) {
              const peer =
                peersRef.current.get(
                  signal.viewerId
                );

              peer?.close();

              peersRef.current.delete(
                signal.viewerId
              );

              pendingViewerIceRef.current.delete(
                signal.viewerId
              );
            }
          }
        );

      signalingRef.current =
        signaling;
    };

    void startSignaling();

    return () => {
      active = false;

      peersRef.current.forEach(
        (peer) => peer.close()
      );

      peersRef.current.clear();

      void signalingRef.current?.close();

      signalingRef.current =
        null;
    };
  }, [
    camera?.streamId,
    camera?.streaming,
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsLiveFullscreen(document.fullscreenElement === liveContainerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleLiveFullscreen = async () => {
    if (!liveContainerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await liveContainerRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    const handleBeforeUnload =
      () => {
        if (camera?.id) {
          void markCameraOffline(
            camera.id
          );
        }
      };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [camera?.id]);

  if (loading) {
    return (
      <div className="page-stack">
        <div className="section-card">
          <div className="empty-state large">
            Đang khởi tạo hệ thống camera...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="hero">
        <div>
          <span className="eyebrow">
            CAMERA CONTROL
          </span>

          <h2>
            Camera trước cửa
          </h2>

          <p>
            Tài khoản camera không có
            quyền quản lý phòng hay
            sử dụng các chức năng của
            người ở.
          </p>
        </div>

        <div className="hero-door">
          {camera?.streaming ? (
            <Video size={27} />
          ) : (
            <VideoOff size={27} />
          )}

          <div>
            <b>
              {camera?.streaming
                ? "Camera đang LIVE"
                : "Camera đang tắt"}
            </b>

            <small>
              @{username}
            </small>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            {camera?.online ? (
              <CircleCheck size={20} />
            ) : (
              <CircleAlert size={20} />
            )}
          </div>

          <div>
            <span>
              Trạng thái
            </span>

            <strong>
              {camera?.online
                ? "Online"
                : "Offline"}
            </strong>

            <small
              className={
                camera?.online
                  ? "green"
                  : "red"
              }
            >
              {camera?.online
                ? "Đang kết nối"
                : "Chưa kết nối"}
            </small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Video size={20} />
          </div>

          <div>
            <span>
              Live stream
            </span>

            <strong>
              {camera?.streaming
                ? "LIVE"
                : "OFF"}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <UserRound size={20} />
          </div>

          <div>
            <span>
              Người phát hiện
            </span>

            <strong>
              {camera?.personDetected
                ? camera.personCount
                : 0}
            </strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <MonitorUp size={20} />
          </div>

          <div>
            <span>
              Stream ID
            </span>

            <strong>
              {camera?.streamId
                ? camera.streamId.slice(
                    0,
                    14
                  )
                : "Chưa có"}
            </strong>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Camera LIVE
            </h3>

            <p>
              Đây là hình ảnh trực tiếp
              từ camera của tài khoản
              này.
            </p>
          </div>

          <span
            className={`live-tag ${
              camera?.streaming
                ? ""
                : "offline"
            }`}
          >
            <span />

            {camera?.streaming
              ? "LIVE"
              : "OFFLINE"}
          </span>
        </div>

        <div
          ref={liveContainerRef}
          style={{
            position:
              "relative",
            width: "100%",
            aspectRatio:
              "4 / 3",
            background:
              "#101114",
            borderRadius:
              "14px",
            overflow:
              "hidden",
          }}
        >
          <video
            ref={(element) => {
              videoRef.current = element;
              setVideoElement(element);
            }}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit:
                "cover",
              display:
                "block",
            }}
          />

          {camera?.streaming && faceVision.face && (() => {
            const box = faceBoxPercent(faceVision.face, videoElement);
            if (!box) return null;
            const borderColor = faceStatusColor(faceVision.phase);

            return (
              <div
                style={{
                  position: "absolute",
                  ...box,
                  border: "3px solid " + borderColor,
                  borderRadius: "14px",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                  zIndex: 2,
                  boxShadow: "0 0 0 1px rgba(0,0,0,.25), 0 0 18px " + borderColor + "66",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "-38px",
                    transform: "translateX(-50%)",
                    padding: "7px 12px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,.78)",
                    color: borderColor,
                    border: "1px solid " + borderColor,
                    fontSize: "13px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 14px rgba(0,0,0,.28)",
                  }}
                >
                  {faceVision.matchedName
                    ? faceVision.matchedName
                    : faceVision.phase === "MATCHING"
                      ? "Đang nhận diện..."
                      : faceVision.phase === "NO_MATCH"
                        ? "Không nhận diện"
                        : "Đang quét khuôn mặt..."}
                </span>
              </div>
            );
          })()}

          {!camera?.streaming && (
            <div
              style={{
                position:
                  "absolute",
                inset: 0,
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                flexDirection:
                  "column",
                gap: "12px",
                color:
                  "#ffffff",
              }}
            >
              <CameraOff
                size={42}
              />

              <b>
                Camera chưa được bật
              </b>

              <span>
                Nhấn “Bật camera” để
                bắt đầu LIVE.
              </span>
            </div>
          )}

          {camera?.streaming && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  zIndex: 3,
                }}
              >
                <button
                  className="outline-button"
                  onClick={() => void toggleLiveFullscreen()}
                  style={{
                    background: "rgba(0,0,0,.65)",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,.35)",
                  }}
                  title={isLiveFullscreen ? "Thu nhỏ camera" : "Phóng toàn màn hình"}
                >
                  {isLiveFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  {isLiveFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                </button>
              </div>
              <div
              style={{
                position:
                  "absolute",
                top: "16px",
                left: "16px",
                display:
                  "flex",
                alignItems:
                  "center",
                gap: "8px",
                padding:
                  "7px 11px",
                borderRadius:
                  "999px",
                background:
                  "rgba(0,0,0,.65)",
                color:
                  "#fff",
                fontSize:
                  "13px",
                fontWeight:
                  600,
              }}
            >
              <span
                style={{
                  width:
                    "8px",
                  height:
                    "8px",
                  borderRadius:
                    "50%",
                  background:
                    "#ef4444",
                }}
              />

              LIVE
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display:
              "flex",
            gap: "10px",
            marginTop:
              "16px",
            flexWrap:
              "wrap",
          }}
        >
          {!camera?.streaming ? (
            <button
              className="primary-button large-button"
              onClick={() =>
                void startCamera()
              }
              disabled={
                starting
              }
            >
              <Camera size={20} />

              {starting
                ? "Đang mở camera..."
                : "Bật camera"}
            </button>
          ) : (
            <button
              className="outline-button"
              onClick={() =>
                void stopCamera()
              }
            >
              <CameraOff
                size={18}
              />

              Tắt camera
            </button>
          )}

          <button
            className="outline-button"
            onClick={() =>
              void startCamera()
            }
            disabled={
              starting ||
              !!camera?.streaming
            }
          >
            <RefreshCw
              size={17}
            />

            Kết nối lại
          </button>
        </div>

        {permissionDenied && (
          <div className="info-box">
            <ShieldCheck size={19} />

            <div>
              <b>
                Cần quyền Camera
              </b>

              <span>
                Ứng dụng cần quyền Camera để phát trực tiếp và nhận diện khuôn mặt.
                Nhấn kết nối lại để xin quyền; nếu đã từ chối trước đó, mở Cài đặt Android.
              </span>

              <button
                type="button"
                className="outline-button"
                onClick={() => {
                  void openAppSettings();
                }}
              >
                Mở Cài đặt ứng dụng
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="info-box">
            <CircleAlert size={19} />

            <div>
              <b>
                Camera
              </b>

              <span>
                {error}
              </span>
            </div>
          </div>
        )}
      </div>

      {camera && (
        <FaceEnrollment
          cameraId={camera.id}
          video={videoElement}
        />
      )}

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Trạng thái thiết bị
            </h3>

            <p>
              Trạng thái này được lưu
              trong Supabase để các
              thành phần khác của hệ
              thống biết camera đang
              hoạt động.
            </p>
          </div>
        </div>

        <div className="realtime-grid">
          <State
            label="Thiết bị"
            value={
              camera?.online
                ? "Online"
                : "Offline"
            }
            good={
              camera?.online
            }
          />

          <State
            label="Streaming"
            value={
              camera?.streaming
                ? "LIVE"
                : "OFF"
            }
            good={
              camera?.streaming
            }
          />

          <State
            label="Phát hiện người"
            value={
              camera?.personDetected
                ? "Có người"
                : "Không"
            }
            good={
              !camera?.personDetected
            }
          />

          <State
            label="Số người"
            value={String(
              camera?.personCount ??
                0
            )}
          />
        </div>
      </div>
    </div>
  );
}

function State({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="state-item">
      <span>
        {label}
      </span>

      <b
        className={
          good === false
            ? "danger-text"
            : ""
        }
      >
        {value}
      </b>
    </div>
  );
}
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CircleAlert,
  CircleCheck,
  Maximize2,
  Minimize2,
  Video,
  VideoOff,
} from "lucide-react";

import {
  getCameraIceServers,
  createCameraSignalingChannel,
  getMyCamera,
  type CameraDevice,
  type CameraSignal,
} from "../lib/cameraService";

type Props = {
  camera: CameraDevice;
};

const createViewerId = () =>
  `viewer-${crypto.randomUUID()}`;

export default function CameraViewer({
  camera,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const peerRef =
    useRef<RTCPeerConnection | null>(
      null
    );

  const signalingRef =
    useRef<
      Awaited<
        ReturnType<
          typeof createCameraSignalingChannel
        >
      > | null
    >(null);

  const viewerIdRef =
    useRef(createViewerId());

  const [connected, setConnected] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const requestTimerRef = useRef<number | null>(null);

  const liveContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLiveFullscreen, setIsLiveFullscreen] = useState(false);

  useEffect(() => {
    if (!camera.streaming) {
      setConnected(false);
      return;
    }

    if (!camera.streamId) {
      setError(
        "Camera chưa có Stream ID."
      );
      return;
    }

    let active = true;

    const setup = async () => {
      try {
        setError(null);

        const signaling =
          await createCameraSignalingChannel(
            camera.streamId!,
            async (
              signal: CameraSignal
            ) => {
              if (!active) {
                return;
              }

              if (
                signal.type ===
                "offer"
              ) {
                if (
                  signal.targetId !==
                  viewerIdRef.current
                ) {
                  return;
                }

                await handleOffer(
                  signal.offer
                );
              }

              if (
                signal.type ===
                "ice-candidate"
              ) {
                if (
                  signal.targetId !==
                  viewerIdRef.current
                ) {
                  return;
                }

                if (signal.candidate) {
                  const peer = peerRef.current;

                  // ICE candidates can arrive before the offer/peer exists.
                  // Queue them instead of silently dropping them.
                  if (!peer || !peer.remoteDescription) {
                    pendingIceRef.current.push(signal.candidate);
                  } else {
                    try {
                      await peer.addIceCandidate(signal.candidate);
                    } catch (candidateError) {
                      console.error(
                        "Không thể thêm ICE candidate:",
                        candidateError
                      );
                    }
                  }
                }
              }
            }
          );

        signalingRef.current =
          signaling;

        const request: CameraSignal =
          {
            type: "viewer-request",
            viewerId:
              viewerIdRef.current,
          };

        await signaling.send(
          request
        );

        // Supabase Broadcast is not a durable queue. Keep requesting the
        // current offer until the camera answers, so opening the viewer
        // during camera-channel startup cannot lose the first request.
        requestTimerRef.current = window.setInterval(() => {
          if (!active) {
            return;
          }

          const state = peerRef.current?.connectionState;
          if (
            peerRef.current &&
            state !== "failed" &&
            state !== "closed" &&
            state !== "disconnected"
          ) {
            return;
          }

          if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
          }

          void signaling.send(request);
        }, 3000);
      } catch (err) {
        console.error(
          "Không thể kết nối camera:",
          err
        );

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể kết nối camera."
          );
        }
      }
    };

    const handleOffer = async (
      offer: RTCSessionDescriptionInit
    ) => {
      const peer =
        await createPeer();

      await peer.setRemoteDescription(
        offer
      );

      const pending = pendingIceRef.current.splice(0);
      for (const candidate of pending) {
        try {
          await peer.addIceCandidate(candidate);
        } catch (candidateError) {
          console.error(
            "Không thể thêm ICE candidate đã chờ:",
            candidateError
          );
        }
      }

      const answer =
        await peer.createAnswer();

      await peer.setLocalDescription(
        answer
      );

      await signalingRef.current?.send(
        {
          type: "answer",
          targetId:
            viewerIdRef.current,
          answer,
        }
      );
    };

    const createPeer = async () => {
      if (peerRef.current) {
        peerRef.current.close();
      }

      const iceServers = await getCameraIceServers();
      const peer =
        new RTCPeerConnection({
          iceServers,
        });

      peer.ontrack = (
        event
      ) => {
        const [stream] =
          event.streams;

        if (
          videoRef.current &&
          stream
        ) {
          videoRef.current.srcObject =
            stream;

          void videoRef.current.play().catch((playError) => {
            console.warn(
              "Không thể tự phát live video:",
              playError
            );
          });

          if (requestTimerRef.current) {
            window.clearInterval(requestTimerRef.current);
            requestTimerRef.current = null;
          }

          setConnected(true);
        }
      };

      peer.onicecandidate = (
        event
      ) => {
        if (
          event.candidate
        ) {
          void signalingRef.current?.send(
            {
              type: "ice-candidate",
              targetId:
                viewerIdRef.current,
              candidate:
                event.candidate.toJSON(),
            }
          );
        }
      };

      peer.onconnectionstatechange =
        () => {
          const state =
            peer.connectionState;

          setConnected(
            state ===
              "connected"
          );

          if (
            state ===
              "failed" ||
            state ===
              "closed" ||
            state ===
              "disconnected"
          ) {
            setConnected(false);

            if (peerRef.current === peer) {
              peer.close();
              peerRef.current = null;
            }

            if (active && signalingRef.current) {
              void signalingRef.current.send({
                type: "viewer-request",
                viewerId: viewerIdRef.current,
              });
            }
          }
        };

      peerRef.current =
        peer;

      return peer;
    };

    void setup();

    return () => {
      active = false;

      if (requestTimerRef.current) {
        window.clearInterval(requestTimerRef.current);
        requestTimerRef.current = null;
      }

      pendingIceRef.current = [];
      peerRef.current?.close();
      peerRef.current =
        null;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }

      void signalingRef.current?.close();
      signalingRef.current =
        null;

      setConnected(false);
    };
  }, [
    camera.streamId,
    camera.streaming,
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
    if (document.fullscreenElement) await document.exitFullscreen();
    else await liveContainerRef.current.requestFullscreen();
  };

  return (
    <div className="section-card">
      <div className="section-head">
        <div>
          <h3>
            Camera trước cửa
          </h3>

          <p>
            Live stream từ tài khoản
            CAMERA.
          </p>
        </div>

        <span
          className={`live-tag ${
            connected
              ? ""
              : "offline"
          }`}
        >
          <span />

          {connected
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
            "16 / 9",
          background:
            "#101114",
          borderRadius:
            "14px",
          overflow:
            "hidden",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit:
              "cover",
            display:
              "block",
          }}
        />

        {!connected && (
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
            {camera.streaming ? (
              <>
                <VideoOff
                  size={42}
                />

                <b>
                  Đang kết nối camera...
                </b>

                <span>
                  Đang chờ WebRTC stream.
                </span>
              </>
            ) : (
              <>
                <Video
                  size={42}
                />

                <b>
                  Camera đang OFFLINE
                </b>
              </>
            )}
          </div>
        )}

        {connected && (
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
            <CircleCheck
              size={15}
            />

            LIVE
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="info-box">
          <CircleAlert
            size={19}
          />

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
  );
}
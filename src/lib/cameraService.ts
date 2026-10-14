import { supabase } from "./supabase";

const TURN_URL = import.meta.env.VITE_TURN_URL?.trim();
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME?.trim();
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

// The project can override these with a private TURN service.
// The fallback is Open Relay's public test relay so cameras behind
// different NATs/Wi-Fi/mobile networks can still establish WebRTC.
const STATIC_AUTH_TURN_HOST = "staticauth.openrelay.metered.ca";
const STATIC_AUTH_TURN_SECRET = "openrelayprojectsecret";

export async function getCameraIceServers(): Promise<RTCConfiguration["iceServers"]> {
  const baseServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];

  if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
    return [
      ...baseServers,
      {
        urls: TURN_URL,
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      },
    ];
  }

  // Open Relay now expects account credentials for its normal TURN endpoint.
  // Its static-auth endpoint accepts short-lived HMAC credentials generated
  // from the published test shared secret, avoiding stale hard-coded passwords.
  const expiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const username = `${expiry}:smart-building-camera`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(STATIC_AUTH_TURN_SECRET),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(username),
  );
  const credential = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return [
    ...baseServers,
    {
      urls: [
        `turn:${STATIC_AUTH_TURN_HOST}:80`,
        `turn:${STATIC_AUTH_TURN_HOST}:443`,
        `turn:${STATIC_AUTH_TURN_HOST}:80?transport=tcp`,
        `turn:${STATIC_AUTH_TURN_HOST}:443?transport=tcp`,
        `turns:${STATIC_AUTH_TURN_HOST}:443`,
      ],
      username,
      credential,
    },
  ];
}

export type CameraDevice = {
  id: string;
  userId: string;
  deviceName: string;
  cameraType:
    | "WEB_CAMERA"
    | "USB_CAMERA"
    | "IP_CAMERA";
  online: boolean;
  streaming: boolean;
  personDetected: boolean;
  personCount: number;
  detectionConfidence: number | null;
  streamId: string | null;
  lastSeen: string | null;
  lastDetectionAt: string | null;
  detectionExpiresAt: string | null;
};

type CameraDeviceRow = {
  id: string;
  user_id: string;
  device_name: string;
  camera_type:
    | "WEB_CAMERA"
    | "USB_CAMERA"
    | "IP_CAMERA";
  online: boolean;
  streaming: boolean;
  person_detected: boolean;
  person_count: number;
  detection_confidence: number | null;
  stream_id: string | null;
  last_seen: string | null;
  last_detection_at: string | null;
  detection_expires_at: string | null;
};

const mapCamera = (
  row: CameraDeviceRow
): CameraDevice => ({
  id: row.id,
  userId: row.user_id,
  deviceName: row.device_name,
  cameraType: row.camera_type,
  online: row.online,
  streaming: row.streaming,
  personDetected:
    row.person_detected,
  personCount:
    row.person_count,
  detectionConfidence:
    row.detection_confidence,
  streamId:
    row.stream_id,
  lastSeen:
    row.last_seen,
  lastDetectionAt:
    row.last_detection_at,
  detectionExpiresAt:
    row.detection_expires_at,
});

/* ==================================================
   CAMERA DEVICE
================================================== */

export async function getMyCamera(
  userId: string
): Promise<CameraDevice | null> {
  const { data, error } =
    await supabase
      .from("camera_devices")
      .select(
        `
          id,
          user_id,
          device_name,
          camera_type,
          online,
          streaming,
          person_detected,
          person_count,
          detection_confidence,
          stream_id,
          last_seen,
          last_detection_at,
          detection_expires_at
        `
      )
      .eq("user_id", userId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapCamera(
    data as CameraDeviceRow
  );
}

export async function getCameraByStreamId(
  streamId: string
): Promise<CameraDevice | null> {
  const { data, error } =
    await supabase
      .from("camera_devices")
      .select(
        `
          id,
          user_id,
          device_name,
          camera_type,
          online,
          streaming,
          person_detected,
          person_count,
          detection_confidence,
          stream_id,
          last_seen,
          last_detection_at,
          detection_expires_at
        `
      )
      .eq("stream_id", streamId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapCamera(
    data as CameraDeviceRow
  );
}

export async function ensureMyCamera(
  userId: string
): Promise<CameraDevice> {
  const existing =
    await getMyCamera(userId);

  if (existing) {
    return existing;
  }

  const { data, error } =
    await supabase
      .from("camera_devices")
      .insert({
        user_id: userId,
        device_name:
          "Camera trước cửa",
        camera_type:
          "WEB_CAMERA",
        online: false,
        streaming: false,
        person_detected: false,
        person_count: 0,
        stream_id:
          `camera-${userId}`,
      })
      .select(
        `
          id,
          user_id,
          device_name,
          camera_type,
          online,
          streaming,
          person_detected,
          person_count,
          detection_confidence,
          stream_id,
          last_seen,
          last_detection_at,
          detection_expires_at
        `
      )
      .single();

  if (error) {
    throw error;
  }

  return mapCamera(
    data as CameraDeviceRow
  );
}

export async function updateCameraStatus(
  cameraId: string,
  values: {
    online?: boolean;
    streaming?: boolean;
    personDetected?: boolean;
    personCount?: number;
    detectionConfidence?: number | null;
    lastSeen?: string;
    lastDetectionAt?: string | null;
    detectionExpiresAt?: string | null;
  }
) {
  const payload: Record<
    string,
    unknown
  > = {};

  if (
    values.online !== undefined
  ) {
    payload.online =
      values.online;
  }

  if (
    values.streaming !==
    undefined
  ) {
    payload.streaming =
      values.streaming;
  }

  if (
    values.lastSeen !==
    undefined
  ) {
    payload.last_seen =
      values.lastSeen;
  }

  if (
    values.personDetected !==
    undefined
  ) {
    payload.person_detected =
      values.personDetected;
  }

  if (
    values.personCount !==
    undefined
  ) {
    payload.person_count =
      values.personCount;
  }

  if (
    values.detectionConfidence !==
    undefined
  ) {
    payload.detection_confidence =
      values.detectionConfidence;
  }

  if (
    values.lastDetectionAt !==
    undefined
  ) {
    payload.last_detection_at =
      values.lastDetectionAt;
  }

  if (
    values.detectionExpiresAt !==
    undefined
  ) {
    payload.detection_expires_at =
      values.detectionExpiresAt;
  }

  const { error } =
    await supabase
      .from("camera_devices")
      .update(payload)
      .eq("id", cameraId);

  if (error) {
    throw error;
  }
}

export async function markCameraOffline(
  cameraId: string
) {
  await updateCameraStatus(
    cameraId,
    {
      online: false,
      streaming: false,
      lastSeen:
        new Date().toISOString(),
    }
  );
}

export function subscribeMyCamera(
  cameraId: string,
  callback: (
    camera: CameraDevice
  ) => void
) {
  const channel =
    supabase
      .channel(
        `camera-device-${cameraId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "camera_devices",
          filter: `id=eq.${cameraId}`,
        },
        (payload) => {
          if (
            payload.eventType ===
              "INSERT" ||
            payload.eventType ===
              "UPDATE"
          ) {
            callback(
              mapCamera(
                payload.new as CameraDeviceRow
              )
            );
          }
        }
      )
      .subscribe();

  return () => {
    void supabase.removeChannel(
      channel
    );
  };
}

/* ==================================================
   WEBRTC SIGNALING
================================================== */

export type CameraSignal =
  | {
      type: "viewer-request";
      viewerId: string;
    }
  | {
      type: "offer";
      targetId: string;
      offer: RTCSessionDescriptionInit;
    }
  | {
      type: "answer";
      targetId: string;
      answer: RTCSessionDescriptionInit;
    }
  | {
      type: "ice-candidate";
      targetId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: "viewer-stop";
      viewerId: string;
    };

export type CameraSignalHandler =
  (signal: CameraSignal) => void;

export async function createCameraSignalingChannel(
  streamId: string,
  handler: CameraSignalHandler
) {
  if (!TURN_URL || !TURN_USERNAME || !TURN_CREDENTIAL) {
    console.info(
      "[Camera WebRTC] Dùng Open Relay TURN fallback. Có thể cấu hình TURN riêng qua VITE_TURN_* khi triển khai production."
    );
  }
  const channel =
    supabase.channel(
      `camera-live-${streamId}`,
      {
        config: {
          broadcast: {
            self: false,
          },
        },
      }
    );

  channel.on(
    "broadcast",
    {
      event: "camera-signal",
    },
    ({ payload }) => {
      handler(
        payload as CameraSignal
      );
    }
  );

  await channel.subscribe();

  return {
    channel,

    send: async (
      signal: CameraSignal
    ) => {
      await channel.send({
        type: "broadcast",
        event: "camera-signal",
        payload: signal,
      });
    },

    close: async () => {
      await supabase.removeChannel(
        channel
      );
    },
  };
}
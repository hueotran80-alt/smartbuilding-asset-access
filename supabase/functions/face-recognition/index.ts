import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL_VERSION = "MobileFaceNet-128-v2";
const MATCH_THRESHOLD = 0.60;
// Bảo vệ lớp server: không tạo lại lệnh FACE trong khoảng này.
const COMMAND_COOLDOWN_MS = 15_000;
const CAMERA_DETECTION_MAX_AGE_MS = 5_000;

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function getOrigin(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  if (
    origin === "https://campro-smart-building.vercel.app" ||
    origin === "https://smart-building-access-no-7cd8.vercel.app" ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:5174"
  ) {
    return origin;
  }
  return "https://campro-smart-building.vercel.app";
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": getOrigin(req),
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      "Vary": "Origin",
    },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== "string") return [];
  return value
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function l2Normalize(values: number[]) {
  let norm = 0;
  for (const value of values) norm += value * value;
  norm = Math.sqrt(norm);
  if (!Number.isFinite(norm) || norm <= 1e-12) return null;
  return values.map((value) => value / norm);
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== 128 || b.length !== 128) return -1;
  let dot = 0;
  for (let i = 0; i < 128; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

function recentDetectionIsValid(
  personDetected: boolean,
  expiresAt: string | null,
) {
  if (!personDetected || !expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  return Number.isFinite(expires) &&
    expires > now &&
    expires - now <= CAMERA_DETECTION_MAX_AGE_MS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": getOrigin(req),
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return json(req, 405, {
      matched: false,
      error: "Method not allowed",
    });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return json(req, 401, {
        matched: false,
        error: "Thiếu phiên đăng nhập.",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return json(req, 401, {
        matched: false,
        error: "Phiên đăng nhập không hợp lệ.",
      });
    }

    const body = await req.json().catch(() => ({}));
    const cameraId = typeof body?.camera_id === "string"
      ? body.camera_id.trim()
      : "";

    const rawEmbedding = body?.embedding;
    if (!cameraId || !Array.isArray(rawEmbedding)) {
      return json(req, 400, {
        matched: false,
        error: "Thiếu camera_id hoặc embedding.",
      });
    }

    if (rawEmbedding.length !== 128) {
      return json(req, 400, {
        matched: false,
        error: "Embedding phải có đúng 128 chiều.",
      });
    }

    const normalizedEmbedding = l2Normalize(
      rawEmbedding.map(Number),
    );

    if (!normalizedEmbedding) {
      return json(req, 400, {
        matched: false,
        error: "Embedding không hợp lệ.",
      });
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id,role,is_active")
        .eq("id", user.id)

        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.role !== "CAMERA" ||
      !profile.is_active
    ) {
      return json(req, 403, {
        matched: false,
        error: "Tài khoản camera không hợp lệ hoặc đã bị vô hiệu hóa.",
      });
    }

    const { data: camera, error: cameraError } =
      await supabaseAdmin
        .from("camera_devices")
        .select(
          "id,user_id,online,streaming,person_detected,detection_expires_at",
        )
        .eq("id", cameraId)
        .maybeSingle();

    if (cameraError || !camera) {
      return json(req, 404, {
        matched: false,
        error: "Không tìm thấy camera.",
      });
    }

    if (camera.user_id !== user.id) {
      return json(req, 403, {
        matched: false,
        error: "Camera không thuộc tài khoản này.",
      });
    }

    if (
      !camera.online ||
      !camera.streaming ||
      !recentDetectionIsValid(
        camera.person_detected,
        camera.detection_expires_at,
      )
    ) {
      return json(req, 409, {
        matched: false,
        error: "Camera chưa ở trạng thái nhận diện hợp lệ.",
      });
    }

    const { data: credentials, error: credentialError } =
      await supabaseAdmin
        .from("face_credentials")
        .select("id,occupant_id,angle,embedding")
        .eq("camera_id", cameraId)
        .eq("status", "ACTIVE")
        .eq("model_version", MODEL_VERSION);

    if (credentialError) {
      console.error("[face-recognition] credential query:", credentialError);
      return json(req, 500, {
        matched: false,
        error: "Không thể tải mẫu khuôn mặt.",
      });
    }

    if (!credentials?.length) {
      return json(req, 409, {
        matched: false,
        error: "Chưa có mẫu khuôn mặt v2 được duyệt cho camera này.",
      });
    }

    const byOccupant = new Map<
      string,
      {
        bestSimilarity: number;
        bestAngle: string;
      }
    >();

    for (const credential of credentials) {
      const storedEmbedding = l2Normalize(
        parseVector(credential.embedding),
      );
      if (!storedEmbedding) continue;

      const similarity = cosineSimilarity(
        normalizedEmbedding,
        storedEmbedding,
      );

      const current = byOccupant.get(credential.occupant_id);
      if (
        !current ||
        similarity > current.bestSimilarity
      ) {
        byOccupant.set(credential.occupant_id, {
          bestSimilarity: similarity,
          bestAngle: credential.angle,
        });
      }
    }

    const ranked = [...byOccupant.entries()]
      .map(([occupantId, value]) => ({
        occupantId,
        ...value,
      }))
      .sort((a, b) => b.bestSimilarity - a.bestSimilarity);

    const best = ranked[0];

    if (
      !best ||
      best.bestSimilarity < MATCH_THRESHOLD
    ) {
      return json(req, 200, {
        matched: false,
        similarity: best?.bestSimilarity ?? 0,
        threshold: MATCH_THRESHOLD,
      });
    }

    const { data: occupant, error: occupantError } =
      await supabaseAdmin
        .from("room_occupants")
        .select("id,room_id,full_name,is_active")
        .eq("id", best.occupantId)
        .maybeSingle();

    if (
      occupantError ||
      !occupant ||
      !occupant.is_active
    ) {
      return json(req, 200, {
        matched: false,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
      });
    }

    const { data: room, error: roomError } =
      await supabaseAdmin
        .from("rooms")
        .select("id,status")
        .eq("id", occupant.room_id)
        .maybeSingle();

    if (
      roomError ||
      !room ||
      room.status !== "OCCUPIED"
    ) {
      return json(req, 200, {
        matched: false,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
      });
    }

    const { count: activeOccupants, error: activeOccupantError } =
      await supabaseAdmin
        .from("room_occupants")
        .select("id", { count: "exact", head: true })
        .eq("room_id", occupant.room_id)
        .eq("is_active", true);

    if (activeOccupantError || !activeOccupants) {
      return json(req, 200, {
        matched: false,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
      });
    }

    if (body?.open_door !== true) {
      return json(req, 200, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
      });
    }

    const { data: device, error: deviceError } =
      await supabaseAdmin
        .from("devices")
        .select("id,online")
        .eq("device_code", "ESP-MAIN-DOOR")
        .maybeSingle();

    if (deviceError || !device) {
      return json(req, 409, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "Không tìm thấy thiết bị cửa.",
      });
    }

    if (!device.online) {
      return json(req, 409, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "ESP-MAIN-DOOR đang offline.",
      });
    }

    // Chỉ áp dụng cho FACE: nếu cửa đã ở trạng thái mở/đã mở khóa,
    // tuyệt đối không gửi thêm một xung OPEN xuống khóa.
    const { data: doorState, error: doorStateError } = await supabaseAdmin
      .from("door_states")
      .select("door_status,lock_status")
      .eq("device_id", device.id)
      .maybeSingle();

    if (doorStateError) {
      console.error("[face-recognition] door state query:", doorStateError);
      return json(req, 503, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "Không đọc được trạng thái cửa, nên không gửi lệnh FACE để bảo vệ khóa.",
      });
    }

    if (
      doorState?.door_status === "OPEN" ||
      doorState?.lock_status === "UNLOCKED"
    ) {
      return json(req, 200, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "Cửa hiện đang mở/đã mở khóa. Không gửi lại lệnh FACE.",
      });
    }

    const cutoff = new Date(
      Date.now() - COMMAND_COOLDOWN_MS,
    ).toISOString();

    const { data: recentCommand } =
      await supabaseAdmin
        .from("door_commands")
        .select("id")
        .eq("device_id", device.id)
        .eq("occupant_id", best.occupantId)
        .eq("command", "OPEN")
        .eq("source", "FACE")
        .in("status", ["PENDING", "SENT", "SUCCESS"])
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (recentCommand) {
      return json(req, 200, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "Lệnh FACE gần nhất vẫn đang trong khoảng bảo vệ, không gửi lại.",
      });
    }

    const { data: command, error: commandError } =
      await supabaseAdmin
        .from("door_commands")
        .insert({
          device_id: device.id,
          user_id: null,
          occupant_id: best.occupantId,
          command: "OPEN",
          source: "FACE",
          status: "PENDING",
        })
        .select("id")
        .single();

    if (commandError || !command) {
      console.error("[face-recognition] command insert:", commandError);
      return json(req, 500, {
        matched: true,
        user_id: null,
        occupant_id: best.occupantId,
        matched_name: occupant.full_name,
        room_id: occupant.room_id,
        angle: best.bestAngle,
        similarity: best.bestSimilarity,
        threshold: MATCH_THRESHOLD,
        command_id: null,
        error: "Không thể tạo lệnh mở cửa.",
      });
    }

    return json(req, 200, {
      matched: true,
      user_id: null,
      occupant_id: best.occupantId,
      matched_name: occupant.full_name,
      room_id: occupant.room_id,
      angle: best.bestAngle,
      similarity: best.bestSimilarity,
      threshold: MATCH_THRESHOLD,
      command_id: command.id,
    });
  } catch (error) {
    console.error("[face-recognition] unexpected error:", error);
    return json(req, 500, {
      matched: false,
      error: error instanceof Error
        ? error.message
        : "Lỗi máy chủ nhận diện khuôn mặt.",
    });
  }
});

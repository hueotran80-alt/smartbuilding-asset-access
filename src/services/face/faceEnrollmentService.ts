import { supabase } from "../../lib/supabase";

export type FaceAngle = "STRAIGHT" | "LEFT" | "RIGHT";

export type FaceEnrollmentSession = {
  id: string;
  occupantId: string;
  cameraId: string;
  status: string;
  expectedSamples: 3;
  expiresAt: string;
};

export type FaceEnrollmentSummary = {
  occupantId: string;
  active: number;
  pending: number;
  latestStatus: string | null;
};

export async function createFaceEnrollmentSession(
  occupantId: string,
  cameraId: string,
  createdBy: string
): Promise<FaceEnrollmentSession> {
  const { data: active } = await supabase
    .from("face_enrollment_sessions")
    .select("id")
    .eq("camera_id", cameraId)
    .in("status", ["PENDING", "CAPTURING", "COMPLETED"])
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (active) {
    throw new Error("Camera đang có một phiên đăng ký khuôn mặt khác.");
  }

  const { data, error } = await supabase
    .from("face_enrollment_sessions")
    .insert({
      occupant_id: occupantId,
      camera_id: cameraId,
      status: "PENDING",
      expected_samples: 3,
      created_by: createdBy,
      expires_at: new Date(Date.now() + 90000).toISOString(),
    })
    .select("id,occupant_id,camera_id,status,expires_at")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    occupantId: data.occupant_id,
    cameraId: data.camera_id,
    status: data.status,
    expectedSamples: 3,
    expiresAt: data.expires_at,
  };
}

export async function getActiveFaceEnrollmentForCamera(
  cameraId: string
): Promise<FaceEnrollmentSession | null> {
  const { data, error } = await supabase
    .from("face_enrollment_sessions")
    .select("id,occupant_id,camera_id,status,expires_at")
    .eq("camera_id", cameraId)
    .in("status", ["PENDING", "CAPTURING"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    occupantId: data.occupant_id,
    cameraId: data.camera_id,
    status: data.status,
    expectedSamples: 3,
    expiresAt: data.expires_at,
  };
}

export async function setEnrollmentStatus(
  sessionId: string,
  status: "CAPTURING" | "COMPLETED" | "APPROVED" | "EXPIRED"
) {
  const { error } = await supabase
    .from("face_enrollment_sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function saveFaceEmbedding(args: {
  occupantId: string;
  cameraId: string;
  enrollmentSessionId: string;
  angle: FaceAngle;
  embedding: number[];
}) {
  if (
    args.embedding.length !== 128 ||
    args.embedding.some((v) => !Number.isFinite(v))
  ) {
    throw new Error("Embedding khuôn mặt không hợp lệ.");
  }

  const { data, error } = await supabase.rpc("save_face_credential", {
    p_occupant_id: args.occupantId,
    p_camera_id: args.cameraId,
    p_enrollment_session_id: args.enrollmentSessionId,
    p_angle: args.angle,
    p_embedding: args.embedding,
  });

  if (error) throw error;
  if (!data || data.length !== 1) {
    throw new Error("Không nhận được bản ghi mẫu khuôn mặt từ máy chủ.");
  }

  return data[0];
}

export async function getEnrollmentSampleAngles(
  sessionId: string
): Promise<FaceAngle[]> {
  const { data, error } = await supabase
    .from("face_credentials")
    .select("angle")
    .eq("enrollment_session_id", sessionId);

  if (error) throw error;
  return (data ?? []).map((row) => row.angle as FaceAngle);
}

export async function approveFaceEnrollment(
  sessionId: string,
  approvedBy: string
) {
  const { data: session, error: sessionReadError } = await supabase
    .from("face_enrollment_sessions")
    .select("id,occupant_id")
    .eq("id", sessionId)
    .single();

  if (sessionReadError) throw sessionReadError;

  const { error: sessionError } = await supabase
    .from("face_enrollment_sessions")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq("id", sessionId);

  if (sessionError) throw sessionError;

  await supabase
    .from("face_credentials")
    .update({ status: "REVOKED" })
    .eq("occupant_id", session.occupant_id)
    .eq("status", "ACTIVE")
    .neq("enrollment_session_id", sessionId);

  const { error: credentialError } = await supabase
    .from("face_credentials")
    .update({ status: "ACTIVE" })
    .eq("enrollment_session_id", sessionId);

  if (credentialError) throw credentialError;
}

export async function getCameraDeviceForEnrollment() {
  const { data, error } = await supabase
    .from("camera_devices")
    .select("id,user_id,device_name,online,streaming")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createFaceEnrollmentForOccupant(
  occupantId: string,
  createdBy: string
) {
  const camera = await getCameraDeviceForEnrollment();

  if (!camera) throw new Error("Chưa có tài khoản CAMERA.");
  if (!camera.id) throw new Error("Camera chưa được cấu hình.");

  const { data: occupant, error: occupantError } = await supabase
    .from("room_occupants")
    .select("id,is_active")
    .eq("id", occupantId)
    .maybeSingle();

  if (occupantError) throw occupantError;
  if (!occupant?.is_active) throw new Error("Người ở không tồn tại hoặc đã ngừng hoạt động.");

  return createFaceEnrollmentSession(
    occupantId,
    camera.id,
    createdBy,
  );
}

export async function getLatestFaceEnrollmentForOccupant(occupantId: string) {
  const { data, error } = await supabase
    .from("face_enrollment_sessions")
    .select("id,occupant_id,camera_id,status,expected_samples,expires_at")
    .eq("occupant_id", occupantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    occupantId: data.occupant_id,
    cameraId: data.camera_id,
    status: data.status,
    expectedSamples: 3 as const,
    expiresAt: data.expires_at,
  };
}

export async function getFaceEnrollmentSummaryForOccupants(
  occupantIds: string[],
): Promise<FaceEnrollmentSummary[]> {
  if (occupantIds.length === 0) return [];

  const { data, error } = await supabase
    .from("face_credentials")
    .select("occupant_id,status,model_version,created_at")
    .in("occupant_id", occupantIds)
    .eq("model_version", "MobileFaceNet-128-v2")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return occupantIds.map((occupantId) => {
    const rows = (data ?? []).filter((row) => row.occupant_id === occupantId);
    return {
      occupantId,
      active: rows.filter((row) => row.status === "ACTIVE").length,
      pending: rows.filter((row) => row.status === "PENDING").length,
      latestStatus: rows[0]?.status ?? null,
    };
  });
}


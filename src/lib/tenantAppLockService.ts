import { supabase } from "./supabase";

export type TenantAppLockStatus = {
  pinGeneration: number;
  biometricReady: boolean;
};

function getClient() {
  if (!supabase) throw new Error("Supabase chưa được cấu hình.");
  return supabase;
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return data && typeof data === "object" ? (data as T) : null;
}

async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("PIN cửa chính phải gồm từ 4 đến 8 chữ số.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Thiết bị không hỗ trợ SHA-256 để xác minh PIN.");
  }
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getTenantAppLockStatus(): Promise<TenantAppLockStatus> {
  const { data, error } = await getClient().rpc("get_tenant_app_lock_status");
  if (error) throw new Error(error.message || "Không thể đọc cài đặt bảo mật phòng.");
  const row = firstRow<{ pin_generation: number | string; biometric_ready: boolean }>(data);
  if (!row) throw new Error("Máy chủ chưa trả về cấu hình khóa lớp 2 cho phòng.");
  return {
    pinGeneration: Number(row.pin_generation),
    biometricReady: Boolean(row.biometric_ready),
  };
}

export async function verifyTenantAppLockPin(pin: string): Promise<{ pinGeneration: number }> {
  const pinHash = await hashPin(pin);
  const { data, error } = await getClient().rpc("verify_tenant_app_lock_pin", {
    input_pin_hash: pinHash,
  });
  if (error) {
    const message = error.message || "Không thể xác minh PIN cửa chính.";
    if (message.includes("INVALID_PIN")) throw new Error("PIN cửa chính không đúng. Hãy nhập PIN hiện tại do Admin cấu hình.");
    if (message.includes("PIN_CONFIG_NOT_FOUND")) throw new Error("Admin chưa cấu hình PIN cửa chính.");
    throw new Error(message);
  }
  const row = firstRow<{ pin_generation: number | string }>(data);
  const value = row?.pin_generation ?? (typeof data === "number" || typeof data === "string" ? data : null);
  const pinGeneration = Number(value);
  if (!Number.isFinite(pinGeneration) || pinGeneration < 1) {
    throw new Error("Máy chủ không trả về phiên bản PIN hợp lệ.");
  }
  return { pinGeneration };
}

export async function registerTenantAppBiometric(occupantId: string): Promise<void> {
  if (!occupantId) throw new Error("Chưa chọn người ở để bật sinh trắc học.");
  const { error } = await getClient().rpc("register_tenant_app_biometric", {
    target_occupant_id: occupantId,
  });
  if (error) throw new Error(error.message || "Không thể lưu đăng ký sinh trắc học cho phòng.");
}

export async function getTenantAppBiometricOccupants(): Promise<string[]> {
  const { data, error } = await getClient().rpc("get_tenant_app_biometric_occupants");
  if (error) throw new Error(error.message || "Không thể tải trạng thái sinh trắc học Android.");
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows
    .map((row) => (row as { occupant_id?: string }).occupant_id)
    .filter((id): id is string => Boolean(id));
}

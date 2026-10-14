import { supabase } from "./supabase";

export type KeypadConfig = {
  deviceId: string;
  pinLength: number;
  pinVersion: number;
  keypadEnabled: boolean;
  confirmKey: string;
  clearKey: string;
  appliedVersion: number;
  updatedAt: string;
};

type ConfigRow = {
  device_id: string;
  pin_length: number;
  pin_version: number;
  keypad_enabled: boolean;
  confirm_key: string;
  clear_key: string;
  applied_version: number;
  updated_at: string;
};

function mapRow(row: ConfigRow): KeypadConfig {
  return {
    deviceId: row.device_id,
    pinLength: Number(row.pin_length),
    pinVersion: Number(row.pin_version),
    keypadEnabled: Boolean(row.keypad_enabled),
    confirmKey: row.confirm_key,
    clearKey: row.clear_key,
    appliedVersion: Number(row.applied_version),
    updatedAt: row.updated_at,
  };
}

export async function getKeypadConfig(): Promise<KeypadConfig | null> {
  const { data, error } = await supabase.rpc(
    "get_door_keypad_config",
  );

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  return row ? mapRow(row as ConfigRow) : null;
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Trình duyệt không hỗ trợ SHA-256. Hãy mở ứng dụng bằng HTTPS.",
    );
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function updateKeypadConfig(input: {
  pin: string;
  pinLength: number;
  keypadEnabled: boolean;
  confirmKey: string;
  clearKey: string;
}) {
  if (!/^\d{4,8}$/.test(input.pin)) {
    throw new Error("PIN phải gồm từ 4 đến 8 chữ số.");
  }

  if (input.pin.length !== input.pinLength) {
    throw new Error("Độ dài PIN không khớp với lựa chọn.");
  }

  if (!/^[0-9ABCD*#]$/.test(input.confirmKey)) {
    throw new Error("Phím xác nhận không hợp lệ.");
  }

  if (!/^[0-9ABCD*#]$/.test(input.clearKey)) {
    throw new Error("Phím xóa không hợp lệ.");
  }

  if (input.confirmKey === input.clearKey) {
    throw new Error("Phím xác nhận và phím xóa phải khác nhau.");
  }

  const pinHash = await sha256Hex(input.pin);

  const { data, error } = await supabase.rpc(
    "update_door_keypad_config",
    {
      new_pin_hash: pinHash,
      new_pin_length: input.pinLength,
      new_keypad_enabled: input.keypadEnabled,
      new_confirm_key: input.confirmKey,
      new_clear_key: input.clearKey,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return Number(data);
}


import { isSupabaseConfigured, supabase } from "./supabase";
import type { AccessLog, MainDoorState } from "../types";

// ============================================================
// ESP-MAIN-DOOR
// ============================================================

const MAIN_DOOR_DEVICE_CODE = "ESP-MAIN-DOOR";

// Render Free có thể sleep sau thời gian không có inbound traffic.
// Đánh thức bridge trước khi tạo door_command để lệnh Web không bị treo PENDING.
const MQTT_BRIDGE_HEALTH_URL =
  "https://smart-building-mqtt-cloud.onrender.com/health";

async function wakeMqttBridge(): Promise<{ success: boolean; error?: string }> {
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(MQTT_BRIDGE_HEALTH_URL, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.ok) {
        return { success: true };
      }
    } catch (error) {
      console.warn("Render MQTT bridge đang khởi động:", error);
    } finally {
      window.clearTimeout(timeout);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }

  return {
    success: false,
    error:
      "Dịch vụ điều khiển cửa trên Render chưa sẵn sàng. Vui lòng thử lại.",
  };
}

// ============================================================
// LẤY SUPABASE CLIENT
// ============================================================

function getSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  return supabase;
}

// ============================================================
// LẤY DEVICE ID TỪ DEVICE CODE
// ============================================================

async function getMainDoorDeviceId(): Promise<string | null> {
  const client = getSupabase();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("devices")
    .select("id")
    .eq("device_code", MAIN_DOOR_DEVICE_CODE)
    .maybeSingle();

  if (error) {
    console.error(
      "Không tìm thấy thiết bị ESP-MAIN-DOOR:",
      error
    );

    return null;
  }

  return data?.id ?? null;
}

// ============================================================
// MAP DOOR STATE
// ============================================================

function mapDoorStateRow(row: {
  door_status?: string | null;
  lock_status?: string | null;
  alarm_status?: string | null;
  device_online?: boolean | null;
  updated_at?: string | null;
}): MainDoorState {
  return {
    door: row.door_status as MainDoorState["door"],
    lock: row.lock_status as MainDoorState["lock"],
    alarm: row.alarm_status as MainDoorState["alarm"],
    deviceOnline: row.device_online ?? false,
    updatedAt:
      row.updated_at ?? new Date().toISOString(),
  };
}

// ============================================================
// LẤY TRẠNG THÁI CỬA
// ============================================================

export async function getDoorState(): Promise<MainDoorState | null> {
  const client = getSupabase();

  if (!client) {
    return null;
  }

  const deviceId = await getMainDoorDeviceId();

  if (!deviceId) {
    console.warn(
      "Không tìm thấy device ESP-MAIN-DOOR."
    );

    return null;
  }

  const { data, error } = await client
    .from("door_states")
    .select(
      "door_status,lock_status,alarm_status,device_online,updated_at"
    )
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error) {
    console.error(
      "Không lấy được trạng thái cửa:",
      error
    );

    return null;
  }

  if (!data) {
    console.warn(
      "Không tìm thấy door_state của ESP-MAIN-DOOR."
    );

    return null;
  }

  return mapDoorStateRow(data);
}

// ============================================================
// REALTIME TRẠNG THÁI CỬA
// ============================================================

export function subscribeDoorState(
  onChange: (state: MainDoorState) => void
) {
  const client = getSupabase();

  if (!client) {
    return () => {};
  }

  let channel: ReturnType<typeof client.channel> | null =
    null;

  let active = true;

  const setupSubscription = async () => {
    const deviceId = await getMainDoorDeviceId();

    if (!active || !deviceId) {
      return;
    }

    channel = client
      .channel("door-state")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "door_states",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row = payload.new as {
            device_id?: string;
            door_status?: string;
            lock_status?: string;
            alarm_status?: string;
            device_online?: boolean;
            updated_at?: string;
          };

          if (
            !row ||
            row.device_id !== deviceId
          ) {
            return;
          }

          onChange(mapDoorStateRow(row));
        }
      )
      .subscribe((status) => {
        console.log(
          "[Realtime door_states]",
          status
        );
      });
  };

  void setupSubscription();

  return () => {
    active = false;

    if (channel) {
      void client.removeChannel(channel);
    }
  };
}

// ============================================================
// YÊU CẦU MỞ CỬA
// ============================================================

/**
 * Gửi yêu cầu mở cửa thông qua database RPC.
 *
 * Database sẽ tự kiểm tra:
 * - user đã đăng nhập
 * - quyền ADMIN/TENANT
 * - TENANT có room
 * - room có occupant active
 * - camera online
 * - camera đang streaming
 * - camera phát hiện người
 * - detection còn hiệu lực
 *
 * AI không tự mở cửa.
 * Chỉ khi user chủ động gọi function này,
 * database mới tạo door_command PENDING.
 *
 * Tham số pin được giữ tạm để tương thích App cũ.
 * Không gửi PIN lên database.
 */
export async function requestRemoteDoorOpen(
  _pin?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  if (!client) {
    return {
      success: false,
      error: "Supabase chưa được cấu hình.",
    };
  }

  const {
    data: sessionData,
    error: sessionError,
  } = await client.auth.getSession();

  if (
    sessionError ||
    !sessionData.session
  ) {
    return {
      success: false,
      error: "Phiên đăng nhập đã hết hạn.",
    };
  }

  const deviceId = await getMainDoorDeviceId();

  if (!deviceId) {
    return {
      success: false,
      error:
        "Không tìm thấy thiết bị cửa chính ESP-MAIN-DOOR.",
    };
  }

  const bridge = await wakeMqttBridge();
  if (!bridge.success) {
    return {
      success: false,
      error: bridge.error,
    };
  }

  const { data, error } = await client.rpc(
    "request_remote_door_open",
    {
      target_device_id: deviceId,
      command_source: "PHONE_BIOMETRIC",
    }
  );

  if (error) {
    console.error(
      "request_remote_door_open error:",
      error
    );

    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}

// ============================================================
// API CŨ - TƯƠNG THÍCH APP HIỆN TẠI
// ============================================================

/**
 * API cũ của App.
 *
 * Giữ tên requestWebUnlock() để App hiện tại
 * chưa cần sửa ngay.
 *
 * Luồng thực tế bên trong đã chuyển sang:
 * request_remote_door_open()
 */
export async function requestWebUnlock(
  pin: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  if (!client) {
    return {
      success: false,
      error: "Supabase chưa được cấu hình.",
    };
  }

  const {
    data: sessionData,
    error: sessionError,
  } = await client.auth.getSession();

  if (
    sessionError ||
    !sessionData.session
  ) {
    return {
      success: false,
      error: "Phiên đăng nhập đã hết hạn.",
    };
  }

  const deviceId = await getMainDoorDeviceId();

  if (!deviceId) {
    return {
      success: false,
      error:
        "Không tìm thấy thiết bị cửa chính ESP-MAIN-DOOR.",
    };
  }

  if (!/^\d{4,8}$/.test(pin)) {
    return {
      success: false,
      error: "PIN phải gồm từ 4 đến 8 chữ số.",
    };
  }

  if (!globalThis.crypto?.subtle) {
    return {
      success: false,
      error:
        "Trình duyệt không hỗ trợ SHA-256. Hãy mở ứng dụng bằng HTTPS.",
    };
  }

  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );
  const pinHash = Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");

  const bridge = await wakeMqttBridge();
  if (!bridge.success) {
    return {
      success: false,
      error: bridge.error,
    };
  }

  const { error } = await client.rpc(
    "request_remote_door_open",
    {
      target_device_id: deviceId,
      command_source: "WEB_PIN",
      pin_hash: pinHash,
    }
  );

  if (error) {
    console.error(
      "request_remote_door_open error:",
      error
    );

    const errorCode = error.message?.split(":")[0];

    return {
      success: false,
      error:
        errorCode === "INVALID_PIN"
          ? "PIN cửa chính không đúng."
          : errorCode === "PIN_REQUIRED"
            ? "PIN cửa chính là bắt buộc."
            : error.message,
    };
  }

  return {
    success: true,
  };
}

// ============================================================
// MAP ACCESS LOG
// ============================================================

function mapAccessLogRow(
  row: {
    id?: string;
    user_id?: string | null;
    room_id?: string | null;
    occupant_id?: string | null;
    device_id?: string | null;
    person_name?: string | null;
    room_number?: string | null;
    method?: string | null;
    result?: string | null;
    reason?: string | null;
    created_at?: string | null;
  }
): AccessLog {
  return {
    id: row.id ?? "",
    time:
      row.created_at ??
      new Date().toISOString(),

    person:
      row.person_name ??
      "Không xác định",

    roomNumber:
      row.room_number ??
      "—",

    method:
      row.method as AccessLog["method"],

    result:
      row.result as AccessLog["result"],

    reason: row.reason ?? null,

    occupantId:
      row.occupant_id ?? null,

    userId:
      row.user_id ?? null,

    deviceId:
      row.device_id ?? null,
  };
}

// ============================================================
// LẤY NHẬT KÝ RA VÀO
// ============================================================

export async function getAccessLogs(
  limit = 50
): Promise<AccessLog[]> {
  const client = getSupabase();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("access_logs")
    .select(
      "id,user_id,room_id,occupant_id,device_id,person_name,room_number,method,result,reason,created_at"
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    console.error(
      "Không lấy được access_logs:",
      error
    );

    return [];
  }

  if (!data) {
    return [];
  }

  return data.map(mapAccessLogRow);
}

// ============================================================
// REALTIME ACCESS LOG
// ============================================================

export function subscribeAccessLogs(
  onInsert: (log: AccessLog) => void
) {
  const client = getSupabase();

  if (!client) {
    return () => {};
  }

  const channel = client
    .channel("access-logs-realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "access_logs",
      },
      (payload) => {
        const row = payload.new as {
          id?: string;
          user_id?: string | null;
          room_id?: string | null;
          occupant_id?: string | null;
          device_id?: string | null;
          person_name?: string | null;
          room_number?: string | null;
          method?: string | null;
          result?: string | null;
          reason?: string | null;
          created_at?: string | null;
        };

        if (!row || !row.id) {
          return;
        }

        onInsert(mapAccessLogRow(row));
      }
    )
    .subscribe((status) => {
      console.log(
        "[Realtime access_logs]",
        status
      );
    });

  return () => {
    void client.removeChannel(channel);
  };
}
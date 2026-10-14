import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// PIN mặc định.
// Khi triển khai thật nên đặt WEB_UNLOCK_PIN bằng Supabase Secrets.
const WEB_UNLOCK_PIN =
  Deno.env.get("WEB_UNLOCK_PIN") || "1234";

// MQTT WebSocket của cùng broker mà ESP đang sử dụng.
const MQTT_WS_URL =
  Deno.env.get("MQTT_WS_URL") ||
  "wss://test.mosquitto.org:8081/mqtt";

const MQTT_COMMAND_TOPIC =
  "smartbuilding/door/command";

const DEVICE_CODE = "ESP-MAIN-DOOR";

const DEVICE_ID =
  "12386227-b313-47b0-9336-0198d4f2703d";

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

// ============================================================
// JSON RESPONSE
// ============================================================

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

// ============================================================
// BEARER TOKEN
// ============================================================

function getBearerToken(
  req: Request,
): string | null {
  const header =
    req.headers.get("Authorization") || "";

  if (
    !header
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return null;
  }

  return header
    .slice(7)
    .trim() || null;
}

// ============================================================
// MQTT UTILITY
// ============================================================

// MQTT UTF-8 string:
// 2 bytes length + UTF-8 data
function mqttString(
  value: string,
): Uint8Array {
  const data =
    new TextEncoder().encode(value);

  const result =
    new Uint8Array(2 + data.length);

  result[0] =
    (data.length >> 8) & 0xff;

  result[1] =
    data.length & 0xff;

  result.set(data, 2);

  return result;
}

// MQTT Remaining Length encoding
function encodeRemainingLength(
  length: number,
): number[] {
  const bytes: number[] = [];

  do {
    let encoded =
      length % 128;

    length =
      Math.floor(length / 128);

    if (length > 0) {
      encoded |= 128;
    }

    bytes.push(encoded);
  } while (length > 0);

  return bytes;
}

// Ghép Uint8Array
function concatBytes(
  ...arrays: Uint8Array[]
): Uint8Array {
  const totalLength =
    arrays.reduce(
      (sum, array) =>
        sum + array.length,
      0,
    );

  const result =
    new Uint8Array(totalLength);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

// ============================================================
// MQTT CONNECT PACKET
// MQTT 3.1.1
// ============================================================

function createMqttConnectPacket(
  clientId: string,
): Uint8Array {
  const protocolName =
    mqttString("MQTT");

  // Protocol level = 4 (MQTT 3.1.1)
  // Connect Flags:
  // Clean Session = 1
  // Keep Alive = 30 seconds
  const variableHeader =
    concatBytes(
      protocolName,
      new Uint8Array([
        0x04, // protocol level
        0x02, // clean session
        0x00,
        0x1e, // keep alive 30
      ]),
    );

  const payload =
    mqttString(clientId);

  const remainingLength =
    variableHeader.length +
    payload.length;

  const fixedHeader =
    new Uint8Array([
      0x10,
      ...encodeRemainingLength(
        remainingLength,
      ),
    ]);

  return concatBytes(
    fixedHeader,
    variableHeader,
    payload,
  );
}

// ============================================================
// MQTT PUBLISH PACKET
// QoS 0
// ============================================================

function createMqttPublishPacket(
  topic: string,
  message: string,
): Uint8Array {
  const topicBytes =
    mqttString(topic);

  const messageBytes =
    new TextEncoder().encode(
      message,
    );

  const remainingLength =
    topicBytes.length +
    messageBytes.length;

  const fixedHeader =
    new Uint8Array([
      0x30, // PUBLISH QoS 0
      ...encodeRemainingLength(
        remainingLength,
      ),
    ]);

  return concatBytes(
    fixedHeader,
    topicBytes,
    messageBytes,
  );
}

// ============================================================
// GỬI MQTT COMMAND QUA WEBSOCKET
// Không sử dụng npm:mqtt
// ============================================================

async function publishUnlock(): Promise<void> {
  await new Promise<void>(
    (resolve, reject) => {
      const clientId =
        `edge-door-unlock-${crypto.randomUUID()}`;

      console.log(
        "[MQTT] Đang kết nối WebSocket:",
        MQTT_WS_URL,
      );

      let finished = false;

      const finishError = (
        error: unknown,
      ) => {
        if (finished) return;

        finished = true;

        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          "[MQTT] ERROR:",
          message,
        );

        try {
          ws.close();
        } catch {
          // ignore
        }

        reject(
          error instanceof Error
            ? error
            : new Error(message),
        );
      };

      const finishSuccess = () => {
        if (finished) return;

        finished = true;

        console.log(
          "[MQTT] Đã publish UNLOCK thành công.",
        );

        try {
          ws.close();
        } catch {
          // ignore
        }

        resolve();
      };

      let ws: WebSocket;

      try {
        // MQTT WebSocket subprotocol
        ws = new WebSocket(
          MQTT_WS_URL,
          ["mqtt"],
        );
      } catch (error) {
        finishError(error);
        return;
      }

      ws.binaryType =
        "arraybuffer";

      const timeout =
        setTimeout(() => {
          finishError(
            new Error(
              "MQTT WebSocket timeout.",
            ),
          );
        }, 10000);

      const clear =
        () => clearTimeout(timeout);

      ws.onopen = () => {
        console.log(
          "[MQTT] WebSocket connected.",
        );

        try {
          const connectPacket =
            createMqttConnectPacket(
              clientId,
            );

          ws.send(
            connectPacket,
          );

          console.log(
            "[MQTT] Đã gửi CONNECT.",
          );
        } catch (error) {
          clear();
          finishError(error);
        }
      };

      ws.onmessage = (
        event,
      ) => {
        try {
          let data: Uint8Array;

          if (
            event.data instanceof ArrayBuffer
          ) {
            data =
              new Uint8Array(
                event.data,
              );
          } else if (
            event.data instanceof Blob
          ) {
            event.data
              .arrayBuffer()
              .then(
                (buffer) => {
                  handleMqttPacket(
                    new Uint8Array(
                      buffer,
                    ),
                  );
                },
              )
              .catch(
                finishError,
              );

            return;
          } else {
            console.warn(
              "[MQTT] Nhận dữ liệu không phải binary.",
            );
            return;
          }

          handleMqttPacket(data);
        } catch (error) {
          clear();
          finishError(error);
        }
      };

      const handleMqttPacket = (
        data: Uint8Array,
      ) => {
        if (
          data.length === 0
        ) {
          return;
        }

        const packetType =
          data[0] >> 4;

        console.log(
          "[MQTT] Packet type:",
          packetType,
        );

        // CONNACK
        if (
          packetType === 2
        ) {
          if (
            data.length >= 4 &&
            data[3] === 0
          ) {
            console.log(
              "[MQTT] Broker CONNACK OK.",
            );

            const publishPacket =
              createMqttPublishPacket(
                MQTT_COMMAND_TOPIC,
                "UNLOCK",
              );

            ws.send(
              publishPacket,
            );

            console.log(
              "[MQTT] Đã gửi:",
              MQTT_COMMAND_TOPIC,
              "-> UNLOCK",
            );

            clear();

            // Chờ một khoảng ngắn để packet được gửi
            setTimeout(
              finishSuccess,
              300,
            );
          } else {
            clear();

            finishError(
              new Error(
                "MQTT broker từ chối CONNECT.",
              ),
            );
          }

          return;
        }

        // PUBLISH từ broker không cần xử lý.
        if (
          packetType === 3
        ) {
          return;
        }

        // DISCONNECT
        if (
          packetType === 14
        ) {
          clear();

          if (!finished) {
            finishError(
              new Error(
                "MQTT broker đã ngắt kết nối.",
              ),
            );
          }
        }
      };

      ws.onerror = () => {
        clear();

        finishError(
          new Error(
            "MQTT WebSocket connection error.",
          ),
        );
      };

      ws.onclose = () => {
        clear();

        if (!finished) {
          finishError(
            new Error(
              "MQTT WebSocket closed before publish completed.",
            ),
          );
        }
      };
    },
  );
}

// ============================================================
// EDGE FUNCTION
// ============================================================

Deno.serve(
  async (req: Request) => {
    // --------------------------------------------------------
    // CORS PREFLIGHT
    // --------------------------------------------------------

    if (
      req.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    // --------------------------------------------------------
    // ONLY POST
    // --------------------------------------------------------

    if (
      req.method !== "POST"
    ) {
      return json(
        405,
        {
          success: false,
          error:
            "Method not allowed.",
        },
      );
    }

    try {
      // ------------------------------------------------------
      // AUTH
      // ------------------------------------------------------

      const token =
        getBearerToken(req);

      if (!token) {
        return json(
          401,
          {
            success: false,
            error:
              "Thiếu phiên đăng nhập.",
          },
        );
      }

      const {
        data: userData,
        error: userError,
      } =
        await supabaseAdmin.auth.getUser(
          token,
        );

      if (
        userError ||
        !userData.user
      ) {
        return json(
          401,
          {
            success: false,
            error:
              "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
          },
        );
      }

      const userId =
        userData.user.id;

      // ------------------------------------------------------
      // BODY
      // ------------------------------------------------------

      const body =
        await req.json()
          .catch(() => ({}));

      const pin =
        typeof body?.pin === "string"
          ? body.pin.trim()
          : "";

      if (!pin) {
        return json(
          400,
          {
            success: false,
            error:
              "Vui lòng nhập mật khẩu.",
          },
        );
      }

      // ------------------------------------------------------
      // PROFILE
      // ------------------------------------------------------

      const {
        data: profile,
        error: profileError,
      } =
        await supabaseAdmin
          .from("profiles")
          .select(
            "id,full_name,role",
          )
          .eq("id", userId)
          .maybeSingle();

      if (profileError) {
        console.error(
          "Profile query error:",
          profileError,
        );

        return json(
          500,
          {
            success: false,
            error:
              "Không đọc được thông tin người dùng.",
          },
        );
      }

      if (!profile) {
        return json(
          403,
          {
            success: false,
            error:
              "Tài khoản chưa có hồ sơ trong hệ thống.",
          },
        );
      }

      const role =
        String(
          profile.role || "",
        ).toUpperCase();

      if (
        role !== "TENANT" &&
        role !== "ADMIN"
      ) {
        return json(
          403,
          {
            success: false,
            error:
              "Tài khoản không có quyền mở cửa.",
          },
        );
      }

      // ------------------------------------------------------
      // KIỂM TRA PIN
      // ------------------------------------------------------

      if (
        pin !== WEB_UNLOCK_PIN
      ) {
        const {
          error: failedLogError,
        } =
          await supabaseAdmin
            .from("access_logs")
            .insert({
              user_id: userId,

              tenant_id:
                role === "TENANT"
                  ? userId
                  : null,

              room_id: null,

              device_id:
                DEVICE_ID,

              person_name:
                profile.full_name ||
                null,

              room_number: null,

              // Database chỉ cho:
              // KEYPAD
              // R558S
              // PHONE_BIOMETRIC
              method:
                "PHONE_BIOMETRIC",

              result: "FAILED",
            });

        if (failedLogError) {
          console.error(
            "Failed access log error:",
            failedLogError,
          );
        }

        return json(
          401,
          {
            success: false,
            error:
              "Mật khẩu sai. Cửa không được mở.",
          },
        );
      }

      // ------------------------------------------------------
      // KIỂM TRA ESP ONLINE
      // ------------------------------------------------------

      const {
        data: device,
        error: deviceError,
      } =
        await supabaseAdmin
          .from("devices")
          .select(
            "id,device_code,online",
          )
          .eq(
            "device_code",
            DEVICE_CODE,
          )
          .maybeSingle();

      if (
        deviceError ||
        !device
      ) {
        console.error(
          "Device query error:",
          deviceError,
        );

        return json(
          500,
          {
            success: false,
            error:
              "Không tìm thấy ESP-MAIN-DOOR.",
          },
        );
      }

      if (!device.online) {
        return json(
          409,
          {
            success: false,
            error:
              "ESP-MAIN-DOOR đang offline.",
          },
        );
      }

      // ------------------------------------------------------
      // MQTT UNLOCK
      // ------------------------------------------------------

      console.log(
        "[door-unlock] ESP đang online.",
      );

      console.log(
        "[door-unlock] Chuẩn bị gửi MQTT UNLOCK.",
      );

      await publishUnlock();

      console.log(
        "[door-unlock] MQTT UNLOCK đã gửi.",
      );

      // ------------------------------------------------------
      // GHI ACCESS LOG
      // ------------------------------------------------------

      const {
        error: logError,
      } =
        await supabaseAdmin
          .from("access_logs")
          .insert({
            user_id: userId,

            tenant_id:
              role === "TENANT"
                ? userId
                : null,

            room_id: null,

            device_id:
              device.id,

            person_name:
              profile.full_name ||
              null,

            room_number: null,

            // Database cho phép PHONE_BIOMETRIC
            method:
              "PHONE_BIOMETRIC",

            result: "SUCCESS",
          });

      if (logError) {
        console.error(
          "access_logs insert error:",
          logError,
        );
      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      return json(
        200,
        {
          success: true,
          message:
            "Đã gửi lệnh mở cửa tới ESP-MAIN-DOOR.",
        },
      );
    } catch (error) {
      console.error(
        "door-unlock error:",
        error,
      );

      return json(
        500,
        {
          success: false,
          error:
            "Không thể gửi lệnh mở cửa. Vui lòng thử lại.",
        },
      );
    }
  },
);
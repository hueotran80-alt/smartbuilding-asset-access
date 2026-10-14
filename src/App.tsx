import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";

import {
  Activity,
  Bell,
  CheckCircle2,
  DoorOpen,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  ShieldCheck,
  Users,
  X,
  XCircle,
  Video,
  Camera,
} from "lucide-react";

import {
  AccessLog,
  MainDoorState,
  Notification,
  Role,
  Room,
  RoomOccupant,
} from "./types";

import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "./lib/nativeBiometric";
import {
  getTenantAppLockStatus,
  verifyTenantAppLockPin,
  registerTenantAppBiometric,
  getTenantAppBiometricOccupants,
} from "./lib/tenantAppLockService";
import { BackgroundDoorMonitor } from "./lib/backgroundDoorMonitor";
import {
  getBiometricCredentials,
  deleteBiometricCredential,
} from "./lib/biometricService";

import {
  getRooms,
  saveTenantToRoom,
  subscribeRooms,
} from "./lib/roomService";

import {
  authenticatePhoneBiometric,
  registerPhoneBiometric,
} from "./lib/webauthnService";

import {
  getAccessLogs,
  getDoorState,
  requestRemoteDoorOpen,
  requestWebUnlock,
  subscribeAccessLogs,
  subscribeDoorState,
} from "./lib/accessService";

import {
  getCurrentProfile,
  login,
  logout,
  subscribeAuth,
  type AuthProfile,
} from "./lib/auth";

import {
  playSound,
  preloadSounds,
  unlockSounds,
  startAlarm,
  stopAlarm,
} from "./lib/soundService";

import LoginPage from "./components/LoginPage";
import CameraDashboard from "./components/CameraDashboard";
import CameraViewer from "./components/CameraViewer";
import KeypadConfigCard from "./components/KeypadConfigCard";
import {
  approveFaceEnrollment,
  createFaceEnrollmentForOccupant,
  getLatestFaceEnrollmentForOccupant,
  getFaceEnrollmentSummaryForOccupants,
} from "./services/face/faceEnrollmentService";
import {
  getCameraByStreamId,
  subscribeMyCamera,
  type CameraDevice,
} from "./lib/cameraService";
type Page =
  | "dashboard"
  | "rooms"
  | "logs"
  | "camera-dashboard"
  | "tenant-home"
  | "tenant-room"
  | "tenant-logs"
  | "tenant-biometric";

type AppLockStatus = "checking" | "setup" | "locked" | "unlocked" | "error";

type AppLockResult = {
  success: boolean;
  error?: string;
};

const nowText = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const generateId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

const tenantPinGenerationStorageKey = (userId: string, roomId: string) =>
  `smartbuilding.tenant-pin-generation:${userId}:${roomId}`;

export default function App() {
  const [profile, setProfile] =
    useState<AuthProfile | null>(null);

  const [viewerCamera, setViewerCamera] =
    useState<CameraDevice | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const isNativeAndroidApp =
    __NATIVE_ANDROID_BUILD__ ||
    (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

  const [appLockStatus, setAppLockStatus] =
    useState<AppLockStatus>("checking");

  const [appLockProfileId, setAppLockProfileId] =
    useState<string | null>(null);

  const [appLockBiometricReady, setAppLockBiometricReady] =
    useState(false);

  const [appLockConfigError, setAppLockConfigError] =
    useState("");

  const [page, setPage] =
    useState<Page>("dashboard");

  const [rooms, setRooms] =
    useState<Room[]>([]);

  const [door, setDoor] =
    useState<MainDoorState>({
      door: "CLOSED",
      lock: "LOCKED",
      alarm: "OFF",
      deviceOnline: false,
      updatedAt:
        new Date().toISOString(),
    });

  const [logs, setLogs] =
    useState<AccessLog[]>([]);

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [selectedRoomId, setSelectedRoomId] =
    useState<string | null>(null);

  const [tenantForm, setTenantForm] =
    useState<{
      roomId: string;
      occupant?: RoomOccupant;
    } | null>(null);

  const [mobileMenu, setMobileMenu] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [unlocking, setUnlocking] =
    useState(false);

  const previousDoorRef = useRef<MainDoorState["door"]>("CLOSED");

  const [registeringBiometric, setRegisteringBiometric] =
    useState(false);

  const doorAlarmTimerRef = useRef<number | null>(null);
  const doorAlarmTriggeredRef = useRef(false);

  useEffect(() => {
    preloadSounds();

    const unlock = () => {
      unlockSounds();
    };

    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Tenant-only second layer. It validates the ADMIN-managed door PIN and
  // remembers only the PIN generation, never the PIN itself.
  const refreshTenantAppLock = useCallback(async (userId: string, roomId: string) => {
    setAppLockStatus("checking");
    setAppLockProfileId(null);
    setAppLockConfigError("");

    try {
      const lock = await getTenantAppLockStatus();
      if (
        profile?.id !== userId ||
        profile?.room_id !== roomId ||
        profile?.role !== "TENANT"
      ) return;

      setAppLockProfileId(userId);
      setAppLockBiometricReady(lock.biometricReady);
      setAppLockConfigError("");

      if (lock.biometricReady) {
        // Room biometrics remain available even when Admin rotates the PIN.
        setAppLockStatus("locked");
        return;
      }

      const savedGeneration = window.localStorage.getItem(
        tenantPinGenerationStorageKey(userId, roomId)
      );
      setAppLockStatus(
        savedGeneration === String(lock.pinGeneration) ? "unlocked" : "setup"
      );
    } catch (error) {
      if (profile?.id !== userId) return;
      setAppLockProfileId(userId);
      setAppLockConfigError(
        error instanceof Error
          ? error.message
          : "Không thể đọc cài đặt khóa lớp 2 của phòng."
      );
      setAppLockStatus("error");
    }
  }, [profile?.id, profile?.room_id, profile?.role]);

  useEffect(() => {
    if (!isNativeAndroidApp || profile?.role !== "TENANT" || !profile.id || !profile.room_id) {
      setAppLockStatus("unlocked");
      setAppLockProfileId(profile?.id ?? null);
      setAppLockBiometricReady(false);
      setAppLockConfigError("");
      return;
    }

    void refreshTenantAppLock(profile.id, profile.room_id);
  }, [
    profile?.id,
    profile?.room_id,
    profile?.role,
    isNativeAndroidApp,
    refreshTenantAppLock,
  ]);

  // When biometric protection is enabled for the room, require it again after
  // returning from the background. Without biometrics, only a changed Admin PIN
  // generation causes another PIN prompt.
  useEffect(() => {
    if (
      !isNativeAndroidApp ||
      profile?.role !== "TENANT" ||
      !profile.id ||
      !profile.room_id
    ) return;

    const tenantUserId = profile.id;
    const tenantRoomId = profile.room_id;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (appLockBiometricReady) {
          setAppLockStatus((current) => current === "unlocked" ? "locked" : current);
        }
        return;
      }
      void refreshTenantAppLock(tenantUserId, tenantRoomId);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [
    profile?.id,
    profile?.room_id,
    profile?.role,
    appLockBiometricReady,
    isNativeAndroidApp,
    refreshTenantAppLock,
  ]);

  const retryAppLockConfig = async (): Promise<void> => {
    if (profile?.id && profile.room_id && profile.role === "TENANT") {
      await refreshTenantAppLock(profile.id, profile.room_id);
    }
  };

  const verifyAppLockPin = async (pin: string): Promise<AppLockResult> => {
    if (!profile?.id || !profile.room_id || profile.role !== "TENANT") {
      return { success: false, error: "Không tìm thấy tài khoản người thuê đang đăng nhập." };
    }

    try {
      const result = await verifyTenantAppLockPin(pin);
      window.localStorage.setItem(
        tenantPinGenerationStorageKey(profile.id, profile.room_id),
        String(result.pinGeneration)
      );
      setAppLockConfigError("");
      setAppLockStatus("unlocked");
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Không thể xác minh PIN do Admin cấu hình.",
      };
    }
  };

  const verifyAppLockBiometric = async (): Promise<AppLockResult> => {
    try {
      const availability = await NativeBiometric.isAvailable();
      if (!availability.available) {
        return {
          success: false,
          error: availability.error ?? "Điện thoại chưa có sinh trắc học được thiết lập. Hãy dùng PIN Admin để tiếp tục.",
        };
      }
      const result = await NativeBiometric.authenticate();
      if (result.success) setAppLockStatus("unlocked");
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Không thể xác thực sinh trắc học.",
      };
    }
  };

  const applyExternalDoorState = (state: MainDoorState) => {
    const previousDoor = previousDoorRef.current;

    if (previousDoor !== "OPEN" && state.door === "OPEN") {
      playSound("doorOpened");
    }

    previousDoorRef.current = state.door;
    setDoor(state);
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    if (!profile?.id) {
      void BackgroundDoorMonitor.stop().catch(() => {});
      return;
    }

    let active = true;

    const startMonitor = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active || !session) return;

        await BackgroundDoorMonitor.requestPermissions();
        if (!active) return;

        await BackgroundDoorMonitor.start({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
          supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      } catch (error) {
        console.warn("Không thể khởi động theo dõi cửa nền:", error);
      }
    };

    void startMonitor();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const role: Role =
    profile?.role ?? "TENANT";

  const currentOccupant = useMemo(() => {
    if (!profile?.room_id) {
      return undefined;
    }

    const room = rooms.find(
      (item) =>
        item.id === profile.room_id
    );

    if (!room) {
      return undefined;
    }

    return room.occupants.find(
      (occupant) =>
        occupant.isActive
    );
  }, [rooms, profile?.room_id]);

  useEffect(() => {
    let active = true;

    void getCurrentProfile()
      .then((nextProfile) => {
        if (!active) {
          return;
        }

        setProfile(nextProfile);

        if (nextProfile?.role === "ADMIN") {
          setPage("dashboard");
        } else if (
          nextProfile?.role === "TENANT"
        ) {
          setPage("tenant-home");
        } else if (
  nextProfile?.role === "CAMERA"
) {
  setPage(
    "camera-dashboard"
  );
}
      })
      .catch((error) => {
        console.error(
          "Initial authentication check failed:",
          error
        );

        if (active) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    const unsubscribe =
      subscribeAuth((nextProfile) => {
        if (!active) {
          return;
        }

        setProfile(nextProfile);

        if (!nextProfile) {
          setPage("dashboard");
          setPassword("");
          setSelectedRoomId(null);
          return;
        }

        if (
          nextProfile.role ===
          "ADMIN"
        ) {
          setPage("dashboard");
        } else if (
          nextProfile.role ===
          "TENANT"
        ) {
          setPage("tenant-home");
        } else {
  setPage(
    "camera-dashboard"
  );
}
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // ==========================================================
  // CAMERA VIEWER
  // ==========================================================

  useEffect(() => {
    if (
      role !== "ADMIN" &&
      role !== "TENANT"
    ) {
      setViewerCamera(null);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    const loadViewerCamera = async () => {
      try {
        const camera =
          await getCameraByStreamId(
            "main-entrance"
          );

        if (!active) {
          return;
        }

        if (!camera) {
          setViewerCamera(null);
          return;
        }

        setViewerCamera(camera);

        unsubscribe =
          subscribeMyCamera(
            camera.id,
            (updatedCamera) => {
              if (active) {
                setViewerCamera(
                  updatedCamera
                );
              }
            }
          );
      } catch (error) {
        console.error(
          "Không thể tải camera:",
          error
        );

        if (active) {
          setViewerCamera(null);
        }
      }
    };

    void loadViewerCamera();

    return () => {
      active = false;

      unsubscribe?.();
      unsubscribe = null;
    };
  }, [role, profile?.id]);


  // ==========================================================
  // ROOMS + OCCUPANTS
  // ==========================================================
  useEffect(() => {
    let active = true;

    if (
  !isSupabaseConfigured ||
  !profile ||
  profile.role === "CAMERA"
) {
  setRooms([]);

  return () => {
    active = false;
  };
}
    const loadRooms = async () => {
      try {
        const data = await getRooms();
        console.log("========== GET ROOMS RESULT ==========");
console.log("ROOMS DATA:", data);
console.log("ROOMS COUNT:", data?.length);
console.log("ROOMS WITH OCCUPANTS:", data?.filter(room => room.occupants?.length > 0));

        if (active) {
          setRooms(data);
        }
      } catch (error) {
        console.error(
          "Không tải được rooms/occupants:",
          error
        );

        if (active) {
          setRooms([]);
        }
      }
    };

    void loadRooms();

    const unsubscribe =
      subscribeRooms(() => {
        void loadRooms();
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile?.id]);

  // ==========================================================
  // MAIN DOOR
  // ==========================================================
  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      return () => {
        active = false;
      };
    }

    void getDoorState().then(
      (state) => {
        if (active && state) {
          applyExternalDoorState(state);
        }
      }
    );

    const unsubscribe =
      subscribeDoorState((state) => {
        if (active) {
          setDoor(state);
        }
      });

    // Realtime là kênh cập nhật chính. Polling 5 giây là lớp dự phòng
    // để WebView/Android hoặc trình duyệt phục hồi trạng thái sau khi
    // WebSocket bị mất kết nối hoặc vừa quay lại foreground.
    const refreshInterval = window.setInterval(() => {
      void getDoorState().then((state) => {
        if (active && state) {
          applyExternalDoorState(state);
        }
      });
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      unsubscribe();
    };
  }, [profile?.role]);

  // ==========================================================
  // ACCESS LOGS
  // ==========================================================
  useEffect(() => {
    let active = true;

    if (
  !isSupabaseConfigured ||
  profile?.role === "CAMERA"
) {
      return () => {
        active = false;
      };
    }

    void getAccessLogs().then(
      (rows) => {
        if (
          active &&
          rows.length > 0
        ) {
          setLogs(rows);
        }
      }
    );

    const unsubscribe =
      subscribeAccessLogs((log) => {
        if (active) {
          setLogs((previous) =>
            [log, ...previous].slice(
              0,
              100
            )
          );
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile?.role]);

  const notify = (
    text: string,
    type: Notification["type"] =
      "info"
  ) => {
    setNotifications(
      (previous) =>
        [
          {
            id: generateId(),
            text,
            type,
            time: nowText(),
          },
          ...previous,
        ].slice(0, 8)
    );
  };

  // Báo động cửa: chỉ kích hoạt khi Reed giữ trạng thái OPEN liên tục 10 giây.
  useEffect(() => {
    if (doorAlarmTimerRef.current !== null) {
      window.clearTimeout(doorAlarmTimerRef.current);
      doorAlarmTimerRef.current = null;
    }

    // OPEN trong DB có thể là trạng thái cuối cùng trước khi ESP mất nguồn.
    // Chỉ chạy bộ đếm báo động khi thiết bị vẫn ONLINE.
    if (!door.deviceOnline) {
      doorAlarmTriggeredRef.current = false;
      stopAlarm();
      if (door.alarm === "ON") {
        setDoor((previous) => ({ ...previous, alarm: "OFF" }));
      }
      return;
    }

    if (door.door !== "OPEN") {
      doorAlarmTriggeredRef.current = false;
      stopAlarm();

      if (door.alarm === "ON") {
        setDoor((previous) => ({ ...previous, alarm: "OFF" }));
      }

      return;
    }

    if (door.alarm === "ON" || doorAlarmTriggeredRef.current) {
      return;
    }

    doorAlarmTimerRef.current = window.setTimeout(() => {
      doorAlarmTimerRef.current = null;

      setDoor((previous) => {
        if (previous.door !== "OPEN" || doorAlarmTriggeredRef.current) {
          return previous;
        }

        doorAlarmTriggeredRef.current = true;
        return {
          ...previous,
          alarm: "ON",
          updatedAt: new Date().toISOString(),
        };
      });

      startAlarm();
      notify("CẢNH BÁO: cửa đã mở liên tục quá 10 giây!", "warning");
    }, 10000);

    return () => {
      if (doorAlarmTimerRef.current !== null) {
        window.clearTimeout(doorAlarmTimerRef.current);
        doorAlarmTimerRef.current = null;
      }
    };
  }, [door.door, door.alarm]);

  const setDoorState = (
    next: Partial<MainDoorState>,
    message?: string
  ) => {
    setDoor((previous) => {
      const merged = {
        ...previous,
        ...next,
        updatedAt: new Date().toISOString(),
      };

      if (previous.door !== "OPEN" && merged.door === "OPEN") {
        playSound("doorOpened");
      }

      previousDoorRef.current = merged.door;
      return merged;
    });

    if (message) {
      notify(
        message,
        next.alarm === "ON"
          ? "warning"
          : "info"
      );
    }
  };

  // ==========================================================
  // SINGLE DOOR UNLOCK ACTION
  // App security is verified before the dashboard is shown.
  // ==========================================================
  const unlockDoorFromApp = async () => {
    if (!door.deviceOnline) {
      notify(
        "ESP-MAIN-DOOR đang offline. Không thể mở cửa từ ứng dụng.",
        "warning"
      );
      return;
    }

    setUnlocking(true);
    try {
      const result = await requestRemoteDoorOpen();
      if (!result.success) {
        playSound("passwordFailed");
        notify(
          result.error ?? "Không thể gửi lệnh mở cửa.",
          "warning"
        );
        return;
      }

      playSound("authSuccess");
      notify(
        "Đã gửi lệnh mở cửa tới ESP-MAIN-DOOR. Đang chờ thiết bị xác nhận...",
        "info"
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Không thể gửi lệnh mở cửa.",
        "warning"
      );
    } finally {
      setUnlocking(false);
    }
  };

  // ==========================================================
  // UNLOCK BY PIN
  // ==========================================================
  const unlockWithPin = async () => {
    if (!door.deviceOnline) {
      notify(
        "ESP-MAIN-DOOR đang offline. Không thể mở cửa từ ứng dụng.",
        "warning"
      );

      return;
    }

    if (isSupabaseConfigured) {
      setUnlocking(true);

      const result =
        await requestWebUnlock(
          password
        );

      setUnlocking(false);
      setPassword("");

      if (!result.success) {
        playSound("passwordFailed");
        notify(
          result.error ??
            "Mật khẩu sai. Cửa không được mở.",
          "warning"
        );

        return;
      }

      playSound("authSuccess");
      notify(
        "Đã gửi lệnh mở cửa tới ESP-MAIN-DOOR. Đang chờ thiết bị xác nhận...",
        "info"
      );

      return;
    }

    // ========================================================
    // DEMO / LOCAL MODE
    // ========================================================
    if (password !== "1234") {
      playSound("passwordFailed");
      notify(
        "Mật khẩu sai. Cửa không được mở.",
        "warning"
      );

      setLogs((previous) => [
        {
          id: generateId(),
          time:
            new Date().toISOString(),
          person:
            currentOccupant?.fullName ??
            profile?.full_name ??
            "Người thuê",
          roomNumber:
            currentOccupant
              ? rooms.find(
                  (room) =>
                    room.id ===
                    currentOccupant.roomId
                )?.roomNumber ?? ""
              : "",
          method: "WEB_PIN",
          result: "FAILED",
        },
        ...previous,
      ]);

      setPassword("");

      return;
    }

    setPassword("");
    playSound("authSuccess");

    setDoorState(
      {
        lock: "UNLOCKED",
      },
      "Cửa chính đã được mở khóa."
    );

    setLogs((previous) => [
      {
        id: generateId(),
        time:
          new Date().toISOString(),
        person:
          currentOccupant?.fullName ??
          profile?.full_name ??
          "Người thuê",
        roomNumber:
          currentOccupant
            ? rooms.find(
                (room) =>
                  room.id ===
                  currentOccupant.roomId
              )?.roomNumber ?? ""
            : "",
        method: "WEB_PIN",
        result: "SUCCESS",
      },
      ...previous,
    ]);

    setTimeout(() => {
      setDoorState(
        {
          door: "OPEN",
        },
        "Cửa chính đang mở."
      );
    }, 700);

    setTimeout(() => {
      setDoorState(
        {
          door: "CLOSED",
          lock: "LOCKED",
        },
        "Đã tự động khóa lại sau 10 giây."
      );
    }, 10000);
  };

  // ==========================================================
  // PHONE BIOMETRIC
  // ==========================================================
  const unlockWithPhoneBiometric =
    async () => {
      if (!door.deviceOnline) {
        notify(
          "ESP-MAIN-DOOR đang offline. Không thể mở cửa từ ứng dụng.",
          "warning"
        );

        return;
      }

      setUnlocking(true);

      const result = Capacitor.getPlatform() === "android"
        ? await NativeBiometric.authenticate()
        : await authenticatePhoneBiometric();

      setUnlocking(false);

      if (!result.success) {
        playSound("fingerprintFailed");
        notify(
          result.error ??
            "Xác thực sinh trắc học trên điện thoại thất bại.",
          "warning"
        );

        return;
      }

      playSound("authSuccess");
      notify(
        "Xác thực sinh trắc học trên điện thoại thành công.",
        "success"
      );

      const unlockResult =
        await requestRemoteDoorOpen();

      if (!unlockResult.success) {
        notify(
          unlockResult.error ??
            "Không thể gửi lệnh mở cửa.",
          "warning"
        );
        return;
      }

      notify(
        "Đã gửi lệnh mở cửa tới ESP-MAIN-DOOR. Đang chờ thiết bị xác nhận...",
        "info"
      );
    };

  // ==========================================================
  // LOCAL DEMO CONTROLS
  // ==========================================================
  const closeDoor = () => {
    setDoorState(
      {
        door: "CLOSED",
        alarm: "OFF",
      },
      "Cửa chính đã đóng."
    );

    setTimeout(() => {
      setDoorState(
        {
          lock: "LOCKED",
        },
        "Khóa từ đã tự động khóa lại."
      );
    }, 500);
  };

  const simulateAlarm = () => {
    setDoorState(
      {
        door: "OPEN",
        lock: "UNLOCKED",
        alarm: "ON",
      },
      "CẢNH BÁO: cửa đã mở quá 10 giây!"
    );

    // Nút kiểm tra phải phát âm thanh ngay, không chờ effect 10 giây.
    startAlarm();
  };

  // ==========================================================
  // ROOM SELECTION
  // ==========================================================
  const updateRoom = async (
    id: string,
    _status: Room["status"]
  ) => {
    const room = rooms.find(
      (item) => item.id === id
    );

    if (!room) {
      return;
    }

    setSelectedRoomId(id);
  };

  // ==========================================================
  // SAVE OCCUPANT
  // ==========================================================
  const saveTenant = async (
    roomId: string,
    occupant: RoomOccupant
  ) => {
    try {
      const room = rooms.find(
        (item) => item.id === roomId
      );

      if (!room) {
        notify(
          "Không tìm thấy phòng.",
          "warning"
        );

        return;
      }

      if (
        !occupant.id ||
        !occupant.fullName.trim()
      ) {
        notify(
          "Vui lòng nhập đầy đủ thông tin người ở.",
          "warning"
        );

        return;
      }

      const existingOccupant =
        room.occupants.find(
          (item) =>
            item.id === occupant.id
        );

      if (
        !existingOccupant &&
        room.occupants.length >=
          room.maxOccupants
      ) {
        notify(
          `Phòng ${room.roomNumber} đã đủ ${room.maxOccupants} người.`,
          "warning"
        );

        return;
      }

      await saveTenantToRoom(
        roomId,
        {
          ...occupant,
          roomId,
          fullName:
            occupant.fullName.trim(),
          phone:
            occupant.phone?.trim() ?? "",
          isActive:
            occupant.isActive ?? true,
        }
      );

      const refreshed =
        await getRooms();

      setRooms(refreshed);
      setTenantForm(null);

      notify(
        "Thông tin người ở đã được lưu vào Supabase.",
        "success"
      );
    } catch (error) {
      console.error(
        "Lưu người ở thất bại:",
        error
      );

      notify(
        error instanceof Error
          ? error.message
          : "Không thể lưu thông tin người ở.",
        "warning"
      );
    }
  };

  // ==========================================================
  // REGISTER PHONE BIOMETRIC
  // ==========================================================
  const registerBiometric = async (occupantId: string) => {
    if (!occupantId) {
      notify("Không xác định được thành viên phòng để đăng ký.", "warning");
      return;
    }

    setRegisteringBiometric(true);
    try {
      if (isNativeAndroidApp) {
        const availability = await NativeBiometric.isAvailable();
        if (!availability.available) {
          notify(
            availability.error ?? "Hãy thiết lập vân tay hoặc sinh trắc học trên điện thoại trước.",
            "warning"
          );
          return;
        }

        const confirmed = await NativeBiometric.authenticate();
        if (!confirmed.success) {
          notify(confirmed.error ?? "Xác nhận sinh trắc học thất bại.", "warning");
          return;
        }

        await registerTenantAppBiometric(occupantId);
        setAppLockBiometricReady(true);
        notify(
          "Đã bật sinh trắc học lớp 2 cho người ở này. Phương thức này vẫn dùng được khi Admin đổi PIN.",
          "success"
        );
        return;
      }

      const result = await registerPhoneBiometric(occupantId);
      if (!result.success) {
        notify(result.error ?? "Đăng ký sinh trắc học trên điện thoại thất bại.", "warning");
        return;
      }

      notify("Đăng ký sinh trắc học trên điện thoại thành công.", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Không thể đăng ký sinh trắc học.",
        "warning"
      );
    } finally {
      setRegisteringBiometric(false);
    }
  };

  const nav = (nextPage: Page) => {
    setPage(nextPage);
    setSelectedRoomId(null);
    setTenantForm(null);
    setMobileMenu(false);
  };

  const handleLogout =
    async () => {
      try {
        await logout();
      } catch (error) {
        console.error(error);

        notify(
          error instanceof Error
            ? error.message
            : "Không thể đăng xuất.",
          "warning"
        );
      }
    };

  const roleNavItems =
    role === "ADMIN"
      ? [
          { id: "dashboard" as Page, label: "Tổng quan", icon: LayoutDashboard },
          { id: "rooms" as Page, label: "Phòng", icon: Home },
          { id: "logs" as Page, label: "Nhật ký ra vào", icon: Activity },
        ]
      : role === "CAMERA"
        ? [
            { id: "camera-dashboard" as Page, label: "Camera LIVE", icon: Video },
          ]
        : [
            { id: "tenant-home" as Page, label: "Khóa thông minh", icon: ShieldCheck },
            { id: "tenant-room" as Page, label: "Phòng của tôi", icon: Home },
            { id: "tenant-logs" as Page, label: "Nhật ký ra vào", icon: Activity },
            { id: "tenant-biometric" as Page, label: "Sinh trắc học", icon: ShieldCheck },
          ];

  const navItems = roleNavItems;

  // ==========================================================
  // AUTH LOADING
  // ==========================================================
  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <img
              className="app-logo"
              src="/app-logo.svg"
              alt="Smart Building"
            />

            <div>
              <strong>
                Smart Building
              </strong>

              <span>
                Access System
              </span>
            </div>
          </div>

          <div className="empty-state large">
            Đang kiểm tra phiên đăng nhập...
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // LOGIN
  // ==========================================================
  if (!profile) {
    return (
      <LoginPage
        onLogin={async (
          email,
          password
        ) => {
          const result =
            await login(
              email,
              password
            );

          if (!result.success) {
            throw new Error(
              result.error ||
                "Không thể đăng nhập."
            );
          }
        }}
      />
    );
  }

  // Android requires the local second lock before any app screen is shown.
  if (
    isNativeAndroidApp &&
    profile.role === "TENANT" &&
    (appLockProfileId !== profile.id || appLockStatus !== "unlocked")
  ) {
    const gateStatus: AppLockStatus =
      appLockProfileId === profile.id ? appLockStatus : "checking";

    return (
      <AppLockGate
        status={gateStatus}
        biometricReady={appLockBiometricReady}
        userLabel={profile.full_name || profile.email}
        error={appLockConfigError}
        onVerifyPin={verifyAppLockPin}
        onVerifyBiometric={verifyAppLockBiometric}
        onRetry={retryAppLockConfig}
        onLogout={() => void handleLogout()}
      />
    );
  }

  // ==========================================================
  // MAIN APP
  // ==========================================================
  return (
    <div className="app-shell">
      {mobileMenu && (
        <button
          type="button"
          aria-label="Đóng menu"
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside
        className={`sidebar ${
          mobileMenu ? "open" : ""
        }`}
      >
        <div className="brand">
          <img
            className="app-logo"
            src="/app-logo.svg"
            alt="Smart Building"
          />

          <div>
            <strong>
              Smart Building
            </strong>

            <span>
              Access System
            </span>
          </div>
        </div>

        <div className="role-badge">
          <img
            className="profile-avatar"
            src="/profile-avatar.svg"
            alt="Ảnh đại diện Smart Building"
          />

          <div className="role-badge-main">
            <b>
              {role === "ADMIN"
                ? "Quản trị viên"
                : role === "CAMERA"
                ? "Camera"
                : "Người thuê"}
            </b>

            <small>
              @{profile.username}
            </small>
          </div>
        </div>

        <nav>
          <div className="nav-caption">
            MENU
          </div>

          {navItems.map(
            (item) => {
              const Icon =
                item.icon;

              return (
                <button
                  key={item.id}
                  className={
                    page === item.id
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    nav(item.id)
                  }
                >
                  <Icon size={19} />

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            }
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="device-mini">
            <span
              className={`dot ${
                door.deviceOnline
                  ? "online"
                  : "offline"
              }`}
            />

            ESP-MAIN-DOOR

            <small>
              {door.deviceOnline
                ? "Online"
                : "Offline"}{" "}
              ·{" "}
              {isSupabaseConfigured
                ? "Cloud realtime"
                : "Demo local"}
            </small>
          </div>

          <button
            className="logout"
            onClick={() =>
              void handleLogout()
            }
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() =>
              setMobileMenu(
                (value) =>
                  !value
              )
            }
          >
            <Menu size={21} />
          </button>

          <div>
            <div className="breadcrumb">
              Smart Building /{" "}
              {role === "ADMIN"
                ? "Quản trị"
                : role === "CAMERA"
                ? "Camera"
                : "Người thuê"}
            </div>

            <h1>
              {navItems.find(
                (item) =>
                  item.id === page
              )?.label ??
                "Chi tiết phòng"}
            </h1>
          </div>

          <div className="top-actions">
            <div className="door-pill">
              <span
                className={`dot ${
                  door.door ===
                  "CLOSED"
                    ? "online"
                    : "danger"
                }`}
              />

              Cửa chính:{" "}

              <b>
                {door.door ===
                "CLOSED"
                  ? "Đóng"
                  : "Đang mở"}
              </b>
            </div>

            <button
              className="notification-button"
              onClick={() =>
                document
                  .getElementById(
                    "notification-panel"
                  )
                  ?.classList.toggle(
                    "show"
                  )
              }
            >
              <Bell size={20} />

              {notifications.length >
                0 && (
                <span>
                  {
                    notifications.length
                  }
                </span>
              )}
            </button>
          </div>
        </header>

        <section className="content">
          <div
            className={`mode-note ${
              isSupabaseConfigured
                ? ""
                : "demo"
            }`}
          >
            <b>
              {isSupabaseConfigured
                ? "Cloud realtime"
                : "Chế độ demo"}
            </b>{" "}
            ·{" "}
            {isSupabaseConfigured
              ? "Đang đọc trạng thái cửa và nhật ký từ Supabase, đồng bộ realtime cho mọi người dùng."
              : "Dữ liệu đang chạy local để demo; cấu hình Supabase trong .env khi triển khai."}
          </div>

          {/* ==================================================
              ADMIN DASHBOARD
          ================================================== */}
         {role === "ADMIN" &&
  page === "dashboard" && (
    <>
      <AdminDashboard
        rooms={rooms}
        door={door}
        onStatus={updateRoom}
        onRoom={(id) => {
          setSelectedRoomId(
            id
          );
          setPage("rooms");
        }}
      />

      {viewerCamera && (
        <div style={{ marginTop: 24 }}>
          <CameraViewer
            camera={viewerCamera}
          />
        </div>
      )}
    </>
  )}

          {/* ==================================================
              ADMIN ROOMS
          ================================================== */}
         {role === "ADMIN" &&
  page === "rooms" && (
              <AdminRooms
                rooms={rooms}
                createdBy={profile.id}
                selectedRoomId={
                  selectedRoomId
                }
                setSelectedRoomId={
                  setSelectedRoomId
                }
                onStatus={updateRoom}
                onEditTenant={(
                  roomId,
                  occupant
                ) =>
                  setTenantForm({
                    roomId,
                    occupant,
                  })
                }
                onAddTenant={(
                  roomId
                ) =>
                  setTenantForm({
                    roomId,
                  })
                }
              />
            )}

          {/* ==================================================
              ADMIN LOGS
          ================================================== */}
          {role === "ADMIN" &&
  page === "logs" && (
              <Logs logs={logs} />
            )}
{/* ==================================================
    CAMERA DASHBOARD
================================================== */}
{role === "CAMERA" &&
  page ===
    "camera-dashboard" && (
    <CameraDashboard
      userId={profile.id}
      username={profile.username ?? ""}
    />
  )}
          {/* ==================================================
              TENANT HOME
          ================================================== */}
          {role === "TENANT" &&
            page ===
              "tenant-home" && (
              <>
                <TenantHome
                  compactUnlock={isNativeAndroidApp}
                  door={door}
                  password={password}
                  setPassword={setPassword}
                  unlocking={unlocking}
                  onUnlock={() => void (isNativeAndroidApp ? unlockDoorFromApp() : unlockWithPin())}
                  onPhoneBiometric={() => void unlockWithPhoneBiometric()}
                  onClose={closeDoor}
                  onAlarm={simulateAlarm}
                  notify={notify}
                />

                {viewerCamera && (
                  <div style={{ marginTop: 24 }}>
                    <CameraViewer
                      camera={viewerCamera}
                    />
                  </div>
                )}
              </>
            )}

          {/* ==================================================
              TENANT ROOM
          ================================================== */}
          {role === "TENANT" &&
            page ===
              "tenant-room" &&
            (currentOccupant ? (
              <TenantRoom
                room={
                  rooms.find(
                    (room) =>
                      room.id ===
                      currentOccupant.roomId
                  )!
                }
              />
            ) : (
              <div className="empty-state large">
                Chưa tìm thấy thông tin phòng của tài khoản này.
              </div>
            ))}

          {/* ==================================================
              TENANT BIOMETRIC
          ================================================== */}
          {role === "TENANT" &&
            page ===
              "tenant-biometric" && (
              <TenantBiometric
                room={
                  rooms.find(
                    (item) => item.id === profile?.room_id
                  ) ?? null
                }
                registering={registeringBiometric}
                nativeAndroid={isNativeAndroidApp}
                onRegister={(occupantId) => void registerBiometric(occupantId)}
              />
            )}

          {/* ==================================================
              TENANT LOGS
          ================================================== */}
          {role === "TENANT" &&
            page ===
              "tenant-logs" && (
              <Logs
                logs={logs.filter(
                  (log) => {
                    if (
                      log.person ===
                      profile.full_name
                    ) {
                      return true;
                    }

                    if (
                      !currentOccupant
                    ) {
                      return false;
                    }

                    const tenantRoom =
                      rooms.find(
                        (room) =>
                          room.id ===
                          currentOccupant.roomId
                      );

                    return (
                      tenantRoom?.roomNumber ===
                      log.roomNumber
                    );
                  }
                )}
              />
            )}
        </section>

        {/* ====================================================
            NOTIFICATIONS
        ==================================================== */}
        <div
          id="notification-panel"
          className="notification-panel"
        >
          <div className="panel-title">
            <strong>
              Thông báo realtime
            </strong>

            <button
              onClick={() =>
                setNotifications(
                  []
                )
              }
            >
              <X size={17} />
            </button>
          </div>

          {notifications.length ===
          0 ? (
            <div className="empty-state">
              Chưa có thông báo mới.
            </div>
          ) : (
            notifications.map(
              (
                notification
              ) => (
                <div
                  className={`notice ${notification.type}`}
                  key={
                    notification.id
                  }
                >
                  <span>
                    {notification.type ===
                    "success" ? (
                      <CheckCircle2
                        size={17}
                      />
                    ) : notification.type ===
                      "warning" ? (
                      <XCircle
                        size={17}
                      />
                    ) : (
                      <Bell size={17} />
                    )}
                  </span>

                  <div>
                    {
                      notification.text
                    }

                    <small>
                      {
                        notification.time
                      }
                    </small>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </main>

      {/* ======================================================
          ADD OCCUPANT
      ====================================================== */}
      {tenantForm &&
        !tenantForm.occupant && (
          <TenantForm
            room={
              rooms.find(
                (room) =>
                  room.id ===
                  tenantForm.roomId
              )!
            }
            onCancel={() =>
              setTenantForm(null)
            }
            onSave={saveTenant}
          />
        )}

      {/* ======================================================
          EDIT OCCUPANT
      ====================================================== */}
      {tenantForm &&
        tenantForm.occupant && (
          <TenantEditModal
            room={
              rooms.find(
                (room) =>
                  room.id ===
                  tenantForm.roomId
              )!
            }
            tenant={
              tenantForm.occupant
            }
            onCancel={() =>
              setTenantForm(null)
            }
            onSave={saveTenant}
          />
        )}
    </div>
  );
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================

function AdminDashboard({
  rooms,
  door,
  onStatus,
  onRoom,
}: {
  rooms: Room[];
  door: MainDoorState;
  onStatus: (
    id: string,
    status: Room["status"]
  ) => void;
  onRoom: (id: string) => void;
}) {
  const occupied = rooms.filter(
    (room) =>
      room.status === "OCCUPIED"
  ).length;

  const empty =
    rooms.length - occupied;

  return (
    <div className="page-stack">
      <div className="hero">
        <div>
          <span className="eyebrow">
            TỔNG QUAN TÒA NHÀ
          </span>

          <h2>
            Quản lý ra vào tập trung
          </h2>

          <p>
            Một cửa chính duy nhất được
            điều khiển và giám sát
            realtime.
          </p>
        </div>

        <div className="hero-door">
          <DoorOpen size={27} />

          <div>
            <b>
              {door.door ===
              "CLOSED"
                ? "Cửa đang đóng"
                : "Cửa đang mở"}
            </b>

            <small>
              {door.lock ===
              "LOCKED"
                ? "Đã khóa"
                : "Đã mở khóa"}
            </small>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <Stat
          icon={Home}
          label="Tổng số phòng"
          value={rooms.length}
        />

        <Stat
          icon={Users}
          label="Đang có người"
          value={occupied}
        />

        <Stat
          icon={Home}
          label="Phòng trống"
          value={empty}
        />

        <Stat
          icon={Activity}
          label="Thiết bị cửa chính"
          value={
            door.deviceOnline
              ? "Online"
              : "Offline"
          }
          status={
            door.deviceOnline
          }
        />
      </div>

      <KeypadConfigCard deviceOnline={door.deviceOnline} />

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Danh sách phòng
            </h3>

            <p>
              Trạng thái phòng được xác định tự động
              dựa trên số người ở đang hoạt động.
            </p>
          </div>
        </div>

        <RoomTable
          rooms={rooms}
          onStatus={onStatus}
          onRoom={onRoom}
        />
      </div>
    </div>
  );
}

// ============================================================
// STAT
// ============================================================

function Stat({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: any;
  label: string;
  value: string | number;
  status?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        <Icon size={20} />
      </div>

      <div>
        <span>{label}</span>

        <strong>{value}</strong>

        {status !==
          undefined && (
          <small
            className={
              status
                ? "green"
                : "red"
            }
          >
            {status
              ? "Kết nối"
              : "Mất kết nối"}
          </small>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ADMIN ROOMS
// ============================================================

function AdminRooms({
  rooms,
  createdBy,
  selectedRoomId,
  setSelectedRoomId,
  onStatus,
  onEditTenant,
  onAddTenant,
}: {
  rooms: Room[];
  createdBy: string;
  selectedRoomId: string | null;
  setSelectedRoomId: (
    id: string | null
  ) => void;
  onStatus: (
    id: string,
    status: Room["status"]
  ) => void;
  onEditTenant: (
    roomId: string,
    occupant: RoomOccupant
  ) => void;
  onAddTenant: (
    roomId: string
  ) => void;
}) {
  const [biometrics, setBiometrics] = useState<
    Awaited<ReturnType<typeof getBiometricCredentials>>
  >([]);
  const [deletingBiometricId, setDeletingBiometricId] =
    useState<string | null>(null);
  const [faceEnrollment, setFaceEnrollment] =
    useState<Awaited<ReturnType<typeof getLatestFaceEnrollmentForOccupant>>>(null);
  const [faceEnrollmentBusy, setFaceEnrollmentBusy] =
    useState(false);
  const [faceEnrollmentNow, setFaceEnrollmentNow] =
    useState(() => Date.now());
  const [faceEnrollmentOccupant, setFaceEnrollmentOccupant] = useState<RoomOccupant | null>(null);
  const [faceEnrollmentSummary, setFaceEnrollmentSummary] = useState<Awaited<ReturnType<typeof getFaceEnrollmentSummaryForOccupants>>>([]);

  useEffect(() => {
    if (!faceEnrollment) return;
    const timer = window.setInterval(() => {
      setFaceEnrollmentNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [faceEnrollment?.id, faceEnrollment?.expiresAt]);

  useEffect(() => {
    let active = true;

    const loadBiometrics = async () => {
      try {
        const data = await getBiometricCredentials();

        if (active) {
          setBiometrics(data);
        }
      } catch (error) {
        console.error(
          "Không thể tải danh sách vân tay:",
          error
        );
      }
    };

    loadBiometrics();

    return () => {
      active = false;
    };
  }, [rooms]);

  useEffect(() => {
    let active = true;

    if (!selectedRoomId) {
      setFaceEnrollment(null);
      setFaceEnrollmentOccupant(null);
      setFaceEnrollmentSummary([]);
      return () => {
        active = false;
      };
    }

    const loadFaceEnrollment = async () => {
      try {
        const room = rooms.find((item) => item.id === selectedRoomId);
        const occupants = room?.occupants ?? [];
        const occupantIds = occupants.map((occupant) => occupant.id);

        const summaries = await getFaceEnrollmentSummaryForOccupants(occupantIds);
        const sessions = await Promise.all(
          occupantIds.map((occupantId) =>
            getLatestFaceEnrollmentForOccupant(occupantId)
          )
        );

        const currentSessionIndex = sessions.findIndex(
          (item) =>
            item &&
            ["PENDING", "CAPTURING", "COMPLETED"].includes(item.status)
        );
        const currentSession =
          currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;

        if (active) {
          setFaceEnrollmentSummary(summaries);
          setFaceEnrollment(currentSession);
          setFaceEnrollmentOccupant(
            currentSession
              ? occupants.find((item) => item.id === currentSession.occupantId) ?? null
              : null
          );
        }
      } catch (error) {
        console.error("Không thể tải trạng thái khuôn mặt theo người ở:", error);
      }
    };

    void loadFaceEnrollment();

    const timer = window.setInterval(
      () => void loadFaceEnrollment(),
      2000
    );

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedRoomId, rooms]);

  const startFaceEnrollment = async (occupant: RoomOccupant) => {
    try {
      setFaceEnrollmentBusy(true);
      const data = await createFaceEnrollmentForOccupant(
        occupant.id,
        createdBy
      );
      setFaceEnrollment(data);
      setFaceEnrollmentOccupant(occupant);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Không thể tạo phiên đăng ký khuôn mặt."
      );
    } finally {
      setFaceEnrollmentBusy(false);
    }
  };

  const approveFace = async () => {
    if (!faceEnrollment) return;

    try {
      setFaceEnrollmentBusy(true);
      await approveFaceEnrollment(faceEnrollment.id, createdBy);
      setFaceEnrollment({
        ...faceEnrollment,
        status: "APPROVED",
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Không thể duyệt nhận diện khuôn mặt."
      );
    } finally {
      setFaceEnrollmentBusy(false);
    }
  };

  const handleDeleteBiometric = async (
    biometricId: string,
    occupantName: string
  ) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa sinh trắc học của ${occupantName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingBiometricId(biometricId);

      await deleteBiometricCredential(
        biometricId
      );

      setBiometrics((current) =>
        current.filter(
          (item) => item.id !== biometricId
        )
      );
    } catch (error) {
      console.error(
        "Không thể xóa sinh trắc học:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Không thể xóa sinh trắc học."
      );
    } finally {
      setDeletingBiometricId(null);
    }
  };

  if (!selectedRoomId) {
    return (
      <div className="page-stack">
        <div className="section-card">
          <div className="section-head">
            <div>
              <h3>
                Quản lý phòng
              </h3>
              <p>
                Quản lý người ở trong từng phòng.
                Trạng thái phòng được cập nhật tự động.
              </p>
            </div>
          </div>
          <RoomTable
            rooms={rooms}
            onStatus={onStatus}
            onRoom={
              setSelectedRoomId
            }
          />
        </div>
      </div>
    );
  }

  const room = rooms.find(
    (item) =>
      item.id === selectedRoomId
  );

  if (!room) {
    return (
      <div className="empty-state large">
        Không tìm thấy phòng.
      </div>
    );
  }

  const canAddOccupant =
    room.occupants.length <
    room.maxOccupants;

  return (
    <div className="page-stack">
      <button
        className="back-button"
        onClick={() =>
          setSelectedRoomId(null)
        }
      >
        ← Quay lại danh sách phòng
      </button>

      <div className="room-detail-head">
        <div>
          <span className="eyebrow">
            CHI TIẾT PHÒNG
          </span>
          <h2>
            Phòng {room.roomNumber}
          </h2>
          <p>
            Tầng {room.floor} ·{" "}
            {room.occupants.length}/
            {room.maxOccupants} người
          </p>
        </div>

        <div
          className={`status-select ${
            room.status ===
            "OCCUPIED"
              ? "rented"
              : "empty"
          }`}
        >
          {room.status ===
          "OCCUPIED"
            ? "Đang có người"
            : "Trống"}
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Người ở trong phòng
            </h3>
            <p>
              Phòng có tối đa{" "}
              {room.maxOccupants} người.
              Trạng thái phòng được DB tự động
              cập nhật theo người ở đang hoạt động.
            </p>
          </div>

          {canAddOccupant && (
            <button
              className="primary-button"
              onClick={() =>
                onAddTenant(
                  room.id
                )
              }
            >
              <Users size={17} />
              Thêm người ở
            </button>
          )}
        </div>

        {room.occupants.length ===
        0 ? (
          <div className="empty-state large">
            Phòng hiện đang trống.
            Hãy thêm người ở để chuyển
            trạng thái phòng thành
            “Đang có người”.
          </div>
        ) : (
          <div className="tenant-list">
            {room.occupants.map(
              (occupant) => {
                const biometric =
                  biometrics.find(
                    (item) =>
                      item.occupantId ===
                      occupant.id &&
                      item.isActive
                  );
                const faceSummary = faceEnrollmentSummary.find(
                  (item) => item.occupantId === occupant.id
                );
                const currentFaceSession =
                  faceEnrollmentOccupant?.id === occupant.id
                    ? faceEnrollment
                    : null;
                const anotherFaceSessionActive =
                  !!faceEnrollment &&
                  ["PENDING", "CAPTURING"].includes(faceEnrollment.status) &&
                  faceEnrollmentOccupant?.id !== occupant.id;

                return (
                  <div
                    className="tenant-row"
                    key={occupant.id}
                  >
                    <div className="avatar">
                      {occupant.fullName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="tenant-main">
                      <b>
                        {occupant.fullName}
                      </b>

                      <span>
                        {occupant.phone ||
                          "Chưa có số điện thoại"}
                      </span>

                      <span
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: biometric
                            ? "#16a34a"
                            : "#6b7280",
                        }}
                      >
                        {biometric
                          ? "✓ Đã đăng ký sinh trắc học"
                          : "○ Chưa đăng ký sinh trắc học"}
                      </span>

                      <span
                        style={{
                          marginTop: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color:
                            currentFaceSession?.status === "COMPLETED" ||
                            (faceSummary?.active ?? 0) >= 3
                              ? "#2563eb"
                              : faceSummary?.pending
                                ? "#d97706"
                                : "#6b7280",
                        }}
                      >
                        {currentFaceSession?.status === "COMPLETED"
                          ? "● Đã chụp đủ 3 mẫu · chờ duyệt"
                          : currentFaceSession?.status === "CAPTURING"
                            ? "● Đang đăng ký khuôn mặt..."
                            : (faceSummary?.active ?? 0) >= 3
                              ? "✓ Đã đăng ký khuôn mặt"
                              : "○ Chưa đăng ký khuôn mặt"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {biometric && (
                        <button
                          className="icon-button"
                          title="Xóa sinh trắc học"
                          disabled={
                            deletingBiometricId ===
                            biometric.id
                          }
                          onClick={() =>
                            handleDeleteBiometric(
                              biometric.id,
                              occupant.fullName
                            )
                          }
                        >
                          <XCircle size={17} />
                        </button>
                      )}

                      <button
                        className="icon-button"
                        title={
                          anotherFaceSessionActive
                            ? "Camera đang đăng ký cho người khác"
                            : currentFaceSession?.status === "COMPLETED"
                              ? "Duyệt mẫu khuôn mặt"
                              : (faceSummary?.active ?? 0) >= 3
                                ? "Đăng ký lại khuôn mặt"
                                : "Đăng ký khuôn mặt"
                        }
                        disabled={anotherFaceSessionActive || faceEnrollmentBusy}
                        onClick={() => {
                          if (
                            currentFaceSession?.status === "COMPLETED" &&
                            currentFaceSession.occupantId === occupant.id
                          ) {
                            void approveFace();
                          } else {
                            void startFaceEnrollment(occupant);
                          }
                        }}
                      >
                        <Camera size={17} />
                      </button>

                      <button
                        className="icon-button"
                        title="Sửa thông tin người ở"
                        onClick={() =>
                          onEditTenant(
                            room.id,
                            occupant
                          )
                        }
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {faceEnrollment && faceEnrollmentOccupant && (
        <div className="section-card">
          <div className="section-head">
            <div>
              <h3>Đăng ký khuôn mặt · {faceEnrollmentOccupant.fullName}</h3>
              <p>
                Camera đang chụp riêng cho người này. Sau khi đủ 3 góc, Admin duyệt để kích hoạt.
              </p>
            </div>
            <Camera size={22} />
          </div>

          <div className="realtime-grid">
            <div className="state-item">
              <span>Người</span>
              <b>{faceEnrollmentOccupant.fullName}</b>
            </div>
            <div className="state-item">
              <span>Trạng thái</span>
              <b>{faceEnrollment.status}</b>
            </div>
            <div className="state-item">
              <span>Hết hạn</span>
              <b>
                {Math.max(
                  0,
                  Math.ceil(
                    (new Date(faceEnrollment.expiresAt).getTime() - faceEnrollmentNow) / 1000
                  )
                )} giây
              </b>
            </div>
          </div>

          {faceEnrollment.status === "COMPLETED" && (
            <button
              className="primary-button large-button"
              onClick={() => void approveFace()}
              disabled={faceEnrollmentBusy}
            >
              <CheckCircle2 size={19} />
              {faceEnrollmentBusy ? "Đang duyệt..." : "Duyệt 3 mẫu khuôn mặt"}
            </button>
          )}
        </div>
      )}

      <div className="info-box">
        <ShieldCheck size={19} />
        <div>
          <b>
            Sinh trắc học trên điện thoại
          </b>
          <span>
            Face ID, vân tay hoặc cơ chế sinh trắc học
            được hệ điều hành hỗ trợ sẽ được xác thực
            bằng WebAuthn. Hệ thống không lưu mẫu sinh trắc học.
          </span>
        </div>
      </div>
    </div>
  );
}
function RoomTable({
  rooms,
  onStatus,
  onRoom,
}: {
  rooms: Room[];
  onStatus: (
    id: string,
    status: Room["status"]
  ) => void;
  onRoom: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Phòng</th>
            <th>Tầng</th>
            <th>Trạng thái</th>
            <th>Người ở</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>
                <button
                  className="table-link"
                  onClick={() => onRoom(room.id)}
                >
                  Phòng {room.roomNumber}
                </button>
              </td>
              <td>{room.floor}</td>
              <td>
                <button
                  className={`status-select ${
                    room.status === "OCCUPIED"
                      ? "rented"
                      : "empty"
                  }`}
                  onClick={() =>
                    onStatus(
                      room.id,
                      room.status === "OCCUPIED"
                        ? "EMPTY"
                        : "OCCUPIED"
                    )
                  }
                >
                  {room.status === "OCCUPIED"
                    ? "Đang có người"
                    : "Trống"}
                </button>
              </td>
              <td>{room.occupants.length}</td>
              <td>
                <button
                  className="outline-button"
                  onClick={() => onRoom(room.id)}
                >
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// TENANT BIOMETRIC
// ============================================================

function TenantBiometric({
  room,
  registering,
  nativeAndroid = false,
  onRegister,
}: {
  room: Room | null;
  registering: boolean;
  nativeAndroid?: boolean;
  onRegister: (occupantId: string) => void;
}) {
  const [biometrics, setBiometrics] = useState<
    Awaited<ReturnType<typeof getBiometricCredentials>>
  >([]);
  const [nativeBiometricOccupantIds, setNativeBiometricOccupantIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void getBiometricCredentials()
      .then((data) => { if (active) setBiometrics(data); })
      .catch((error) => console.error("Không thể tải trạng thái sinh trắc học:", error));

    if (nativeAndroid) {
      void getTenantAppBiometricOccupants()
        .then((ids) => { if (active) setNativeBiometricOccupantIds(ids); })
        .catch((error) => console.error("Không thể tải trạng thái sinh trắc học Android:", error));
    } else {
      setNativeBiometricOccupantIds([]);
    }

    return () => { active = false; };
  }, [room?.id, registering, nativeAndroid]);

  const occupants = room?.occupants.filter((occupant) => occupant.isActive) ?? [];

  return (
    <div className="page-stack">
      <div className="hero tenant-hero">
        <div>
          <span className="eyebrow">
            BẢO MẬT TÀI KHOẢN
          </span>

          <h2>
            Đăng ký sinh trắc học
          </h2>

          <p>
            {nativeAndroid
              ? "Xác nhận sinh trắc học trên điện thoại cho từng người ở để bật lớp 2 của ứng dụng. PIN vẫn do Admin quản lý."
              : "Đăng ký Face ID, vân tay hoặc phương thức bảo mật của điện thoại để sử dụng khi mở cửa."}
          </p>
        </div>

        <div className="big-door-state closed">
          <ShieldCheck size={42} />

          <b>{nativeAndroid ? "ANDROID BIOMETRIC" : "WEB AUTHN"}</b>

          <small>
            Không lưu dữ liệu khuôn mặt hoặc vân tay
          </small>
        </div>
      </div>

      <div className="section-card unlock-card">
        <div className="section-head">
          <div>
            <h3>
              Chọn người để đăng ký
            </h3>

            <p>
              Sinh trắc học được gắn với từng người ở trong phòng,
              không gắn chung cho cả phòng hoặc cho thiết bị.
            </p>
          </div>

          <ShieldCheck size={24} />
        </div>

        {!room ? (
          <div className="empty-state large">
            Không tìm thấy phòng của tài khoản.
          </div>
        ) : occupants.length === 0 ? (
          <div className="empty-state large">
            Phòng {room.roomNumber} chưa có người ở hoạt động.
          </div>
        ) : (
          <div className="tenant-list">
            {occupants.map((occupant) => {
              const biometric = biometrics.find(
                (item) => item.occupantId === occupant.id && item.isActive
              );
              const nativeBiometric = nativeAndroid && nativeBiometricOccupantIds.includes(occupant.id);
              const registered = Boolean(biometric || nativeBiometric);

              return (
                <div className="tenant-row" key={occupant.id}>
                  <div className="avatar">
                    {occupant.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="tenant-main">
                    <b>{occupant.fullName}</b>
                    <span>
                      {occupant.phone || "Chưa có số điện thoại"}
                    </span>
                    <span
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: registered ? "#16a34a" : "#6b7280",
                      }}
                    >
                      {nativeBiometric
                        ? "✓ Đã bật sinh trắc học lớp 2 cho ứng dụng Android"
                        : biometric
                          ? "✓ Đã đăng ký sinh trắc học"
                          : "○ Chưa đăng ký sinh trắc học"}
                    </span>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => onRegister(occupant.id)}
                    disabled={registering || registered}
                  >
                    <ShieldCheck size={17} />
                    {registered
                      ? (nativeBiometric ? "Đã bật lớp 2" : "Đã đăng ký")
                      : registering
                        ? "Đang xác thực..."
                        : "Đăng ký người này"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="info-box">
          <ShieldCheck size={19} />

          <div>
            <b>{nativeAndroid ? "Sinh trắc học Android theo từng người ở" : "WebAuthn / Passkey theo từng cá nhân"}</b>

            <span>
              {nativeAndroid
                ? "Android xác nhận vân tay hoặc sinh trắc học đã thiết lập trên điện thoại. Hệ thống chỉ lưu trạng thái đã bật cho người ở, không lưu mẫu sinh trắc học. Khi Admin đổi PIN, phương thức này vẫn được giữ."
                : "Face ID, vân tay hoặc xác thực thiết bị được xử lý bởi hệ điều hành. Database chỉ lưu credential công khai và liên kết credential đó với đúng người ở đã chọn."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TENANT APP LOCK GATE — second layer based on Admin PIN or room biometric
// ============================================================

function AppLockGate({
  status,
  biometricReady,
  userLabel,
  error,
  onVerifyPin,
  onVerifyBiometric,
  onRetry,
  onLogout,
}: {
  status: AppLockStatus;
  biometricReady: boolean;
  userLabel: string;
  error: string;
  onVerifyPin: (pin: string) => Promise<AppLockResult>;
  onVerifyBiometric: () => Promise<AppLockResult>;
  onRetry: () => Promise<void>;
  onLogout: () => void;
}) {
  const [pin, setPin] = useState("");
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  const submitPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError("");
    if (!/^\d{4,8}$/.test(pin)) {
      setLocalError("PIN cửa chính phải gồm từ 4 đến 8 chữ số.");
      return;
    }

    setBusy(true);
    try {
      const result = await onVerifyPin(pin);
      if (!result.success) {
        setLocalError(result.error ?? "PIN do Admin cấu hình không đúng.");
        setPin("");
      }
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Không thể xác minh PIN.");
    } finally {
      setBusy(false);
    }
  };

  const authenticateBiometric = async () => {
    setBusy(true);
    setLocalError("");
    try {
      const result = await onVerifyBiometric();
      if (!result.success) {
        setLocalError(result.error ?? "Xác thực sinh trắc học thất bại.");
      }
    } catch (actionError) {
      setLocalError(actionError instanceof Error ? actionError.message : "Không thể xác thực sinh trắc học.");
    } finally {
      setBusy(false);
    }
  };

  const pinFormVisible = status === "setup" || (status === "locked" && showPinFallback);

  return (
    <div className="app-lock-screen">
      <div className="app-lock-panel">
        <div className="login-brand app-lock-brand">
          <img className="app-logo" src="/app-logo.svg" alt="Smart Building" />
          <div><strong>Smart Building</strong><span>Bảo vệ tài khoản người thuê</span></div>
        </div>
        <div className="app-lock-icon"><ShieldCheck size={34} /></div>
        <h1>
          {status === "checking" ? "Đang kiểm tra bảo mật" :
            status === "error" ? "Không thể kiểm tra bảo mật" :
            status === "setup" ? "Xác minh PIN lớp 2" : "Mở khóa lớp 2"}
        </h1>
        <p className="app-lock-description">
          {status === "checking" ? "Đang tải cấu hình PIN và sinh trắc học của phòng." :
            status === "error" ? "Không thể đọc cấu hình bảo mật. Hãy thử lại trước khi tiếp tục." :
            status === "setup" ? "Nhập PIN cửa chính hiện tại do Admin cài đặt. PIN được ghi nhớ theo phiên bản; bạn chỉ cần nhập lại khi Admin đổi PIN." :
            biometricReady ? `Xin xác thực sinh trắc học để tiếp tục với tài khoản ${userLabel}. Nếu sinh trắc học không khả dụng, bạn có thể nhập PIN hiện tại do Admin cài đặt.` :
            `Đang xác minh quyền truy cập cho tài khoản ${userLabel}.`}
        </p>

        {status === "checking" && <div className="app-lock-loading">Đang kiểm tra...</div>}

        {status === "error" && (
          <div className="app-lock-actions">
            <p className="app-lock-error">{error || "Không thể đọc cấu hình khóa lớp 2."}</p>
            <button className="primary-button app-lock-primary" disabled={busy} onClick={() => void onRetry()}>Thử lại</button>
          </div>
        )}

        {status === "locked" && biometricReady && (
          <div className="app-lock-actions">
            <button className="primary-button app-lock-primary" disabled={busy} onClick={() => void authenticateBiometric()}>
              <ShieldCheck size={20} />
              {busy ? "Đang xác thực..." : "Xác thực sinh trắc học"}
            </button>
            {!showPinFallback && (
              <button className="app-lock-back" type="button" onClick={() => { setShowPinFallback(true); setLocalError(""); }}>
                Dùng PIN cửa chính do Admin cài đặt
              </button>
            )}
          </div>
        )}

        {status === "locked" && localError && !pinFormVisible && (
          <p className="app-lock-error" role="alert">{localError}</p>
        )}

        {pinFormVisible && (
          <form className="app-lock-form" onSubmit={(event) => void submitPin(event)}>
            <label htmlFor="tenant-admin-door-pin">PIN cửa chính do Admin cài đặt</label>
            <input
              id="tenant-admin-door-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Nhập PIN hiện tại"
              disabled={busy}
              autoFocus
            />
            {localError && <p className="app-lock-error" role="alert">{localError}</p>}
            <button className="primary-button app-lock-primary" type="submit" disabled={busy || pin.length < 4}>
              {busy ? "Đang xác minh..." : "Xác minh và tiếp tục"}
            </button>
            {status === "locked" && (
              <button className="app-lock-back" type="button" onClick={() => { setShowPinFallback(false); setPin(""); setLocalError(""); }}>
                Quay lại sinh trắc học
              </button>
            )}
            <small className="app-lock-note">Đây là PIN do Admin quản lý, không phải PIN tự tạo trong ứng dụng. PIN không được lưu dạng chữ trên điện thoại.</small>
          </form>
        )}

        {(status === "setup" || status === "locked") && (
          <button className="app-lock-back app-lock-logout" onClick={onLogout}>Đăng xuất tài khoản</button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TENANT HOME
// ============================================================

function TenantHome({
  compactUnlock,
  door,
  password,
  setPassword,
  unlocking,
  onUnlock,
  onPhoneBiometric,
  onClose,
  onAlarm,
  notify,
}: {
  compactUnlock: boolean;
  door: MainDoorState;
  password: string;
  setPassword: (
    value: string
  ) => void;
  unlocking: boolean;
  onUnlock: () => void;
  onPhoneBiometric: () => void;
  onClose: () => void;
  onAlarm: () => void;
  notify: (
    text: string,
    type?: Notification["type"]
  ) => void;
}) {
  return (
    <div className="page-stack">
      <div className="hero tenant-hero">
        <div>
          <span className="eyebrow">
            KHÓA THÔNG MINH
          </span>

          <h2>
            Cửa chính tòa nhà
          </h2>

          <p>
            Trạng thái được đồng bộ
            realtime cho tất cả người dùng.
          </p>
        </div>

        <div
          className={`big-door-state ${
            door.door ===
            "CLOSED"
              ? "closed"
              : "open"
          }`}
        >
          <span className="state-dot" />

          <b>
            {door.door ===
            "CLOSED"
              ? "ĐANG ĐÓNG"
              : "ĐANG MỞ"}
          </b>

          <small>
            {door.alarm ===
            "ON"
              ? "⚠ Báo động đang bật"
              : door.lock ===
                "LOCKED"
              ? "Đã khóa"
              : "Đã mở khóa"}
          </small>
        </div>
      </div>

      {compactUnlock ? (
      <div className="section-card door-control-card">
        <div className="section-head">
          <div>
            <h3>Mở khóa cửa chính</h3>
            <p>Ứng dụng đã được xác thực bằng lớp bảo vệ đã lưu trên thiết bị.</p>
          </div>
          <ShieldCheck size={23} />
        </div>
        <div className="door-control-body">
          <div className={`door-control-symbol ${door.lock === "LOCKED" ? "locked" : "unlocked"}`}>
            {door.lock === "LOCKED" ? <KeyRound size={35} /> : <DoorOpen size={35} />}
          </div>
          <button
            type="button"
            className="door-unlock-button"
            onClick={onUnlock}
            disabled={unlocking || !door.deviceOnline}
          >
            <KeyRound size={21} />
            {unlocking ? "Đang gửi lệnh..." : "Mở khóa"}
          </button>
          <p className="door-control-hint">
            {!door.deviceOnline
              ? "Thiết bị cửa đang ngoại tuyến. Bạn chưa thể mở cửa từ ứng dụng."
              : "Nhấn một lần để gửi yêu cầu mở cửa. Trạng thái thật sẽ cập nhật khi thiết bị xác nhận."}
          </p>
        </div>
      </div>
      ) : (
        <div className="lock-grid">
          <div className="section-card unlock-card">
            <div className="section-head">
              <div>
                <h3>
                  Mở cửa bằng mật khẩu
                </h3>

                <p>
                  Nhập mật khẩu cửa chính và
                  xác nhận.
                </p>
              </div>

              <KeyRound size={22} />
            </div>

            <div className="password-row">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="PIN 4–8 số"
                value={password}
                disabled={unlocking}
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    onUnlock();
                  }
                }}
              />

              <button
                className="primary-button large-button"
                onClick={onUnlock}
                disabled={
                  unlocking ||
                  password.length < 4
                }
              >
                {unlocking
                  ? "Đang mở..."
                  : "Mở cửa"}
              </button>
            </div>

            <small className="hint">
              PIN cửa chính do Admin cấu hình
              và dùng chung với bàn phím vật lý.
            </small>
          </div>

          <div className="section-card unlock-card">
            <div className="section-head">
              <div>
                <h3>
                  Mở bằng sinh trắc học điện thoại
                </h3>

                <p>
                  Xác thực bằng Face ID, vân tay hoặc cơ chế bảo mật
                  của điện thoại thông qua WebAuthn.
                </p>
              </div>

              <ShieldCheck size={22} />
            </div>

            <button
              className="fingerprint-button"
              onClick={
                onPhoneBiometric
              }
              disabled={unlocking}
            >
              <ShieldCheck size={38} />

              <span>
                Chạm để xác thực trên điện thoại
              </span>

              <small>
                WebAuthn · Face ID / Vân tay
              </small>
            </button>
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Trạng thái realtime
            </h3>

            <p>
              Thay đổi cửa được hiển thị trên
              các thiết bị đang kết nối.
            </p>
          </div>

          <span
            className={`live-tag ${
              door.deviceOnline
                ? ""
                : "offline"
            }`}
          >
            <span />

            {door.deviceOnline
              ? "LIVE"
              : "OFFLINE"}
          </span>
        </div>

        <div className="realtime-grid">
          <StateItem
            label="Cửa"
            value={
              door.door ===
              "CLOSED"
                ? "Đóng"
                : "Mở"
            }
          />

          <StateItem
            label="Khóa từ"
            value={
              door.lock ===
              "LOCKED"
                ? "Đang khóa"
                : "Đã mở khóa"
            }
          />

          <StateItem
            label="Báo động"
            value={
              door.alarm ===
              "ON"
                ? "ĐANG BẬT"
                : "Tắt"
            }
            danger={
              door.alarm ===
              "ON"
            }
          />
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="demo-controls">
          <span>
            Demo mô phỏng thiết bị
          </span>

          <button
            onClick={() =>
              notify(
                "Có sự kiện cửa chính đang được cập nhật.",
                "info"
              )
            }
          >
            Tạo thông báo
          </button>

          <button
            onClick={onClose}
          >
            Đóng cửa
          </button>

          <button
            onClick={onAlarm}
          >
            Kích hoạt báo động &gt;10s
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STATE ITEM
// ============================================================

function StateItem({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="state-item">
      <span>
        {label}
      </span>

      <b
        className={
          danger
            ? "danger-text"
            : ""
        }
      >
        {value}
      </b>
    </div>
  );
}

// ============================================================
// TENANT ROOM
// ============================================================

function TenantRoom({
  room,
}: {
  room: Room;
}) {
  return (
    <div className="page-stack">
      <div className="room-detail-head">
        <div>
          <span className="eyebrow">
            THÔNG TIN CỦA TÔI
          </span>

          <h2>
            Phòng {room.roomNumber}
          </h2>

          <p>
            Tầng {room.floor}
          </p>
        </div>

        <div className="occupancy">
          <Users size={19} />

          <b>
            {
              room.occupants
                .length
            }
          </b>

          <span>
            người
          </span>
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Người đang ở phòng
            </h3>

            <p>
              Danh sách thành viên cùng phòng.
            </p>
          </div>
        </div>

        {room.occupants.length ===
        0 ? (
          <div className="empty-state">
            Chưa có người ở đang hoạt động.
          </div>
        ) : (
          <div className="tenant-list">
            {room.occupants.map(
              (occupant) => (
                <div
                  className="tenant-row"
                  key={occupant.id}
                >
                  <div className="avatar">
                    {occupant.fullName
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="tenant-main">
                    <b>
                      {occupant.fullName}
                    </b>

                    <span>
                      Người ở
                      {occupant.phone
                        ? ` · ${occupant.phone}`
                        : ""}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LOGS
// ============================================================

function Logs({
  logs,
}: {
  logs: AccessLog[];
}) {
  const methodText = (
    method: AccessLog["method"]
  ) => {
    switch (method) {
      case "KEYPAD":
        return "Bàn phím vật lý";

      case "WEB_PIN":
        return "Mật khẩu Web/App";

      case "PHONE_BIOMETRIC":
        return "Sinh trắc học điện thoại";

      case "FINGERPRINT":
        return "Vân tay";

      case "FACE":
        return "Nhận diện khuôn mặt";

      case "PASSKEY":
        return "Passkey / WebAuthn";

      case "ADMIN":
        return "Quản trị viên";

      default:
        return method;
    }
  };

  return (
    <div className="page-stack">
      <div className="section-card">
        <div className="section-head">
          <div>
            <h3>
              Nhật ký ra vào
            </h3>

            <p>
              Lịch sử các lần xác thực và
              mở cửa chính.
            </p>
          </div>
        </div>

        {logs.length ===
        0 ? (
          <div className="empty-state large">
            Chưa có nhật ký ra vào.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Thời gian
                  </th>

                  <th>
                    Người dùng
                  </th>

                  <th>
                    Phòng
                  </th>

                  <th>
                    Phương thức
                  </th>

                  <th>
                    Kết quả
                  </th>
                </tr>
              </thead>

              <tbody>
                {logs.map(
                  (log) => (
                    <tr
                      key={log.id}
                    >
                      <td>
                        {new Date(
                          log.time
                        ).toLocaleString(
                          "vi-VN"
                        )}
                      </td>

                      <td>
                        <b>
                          {
                            log.person
                          }
                        </b>
                      </td>

                      <td>
                        {
                          log.roomNumber
                        }
                      </td>

                      <td>
                        {methodText(
                          log.method
                        )}
                      </td>

                      <td>
                        <span
                          className={`result ${
                            log.result ===
                            "SUCCESS"
                              ? "success"
                              : log.result ===
                                "BLOCKED"
                              ? "failed"
                              : "failed"
                          }`}
                        >
                          {log.result ===
                          "SUCCESS"
                            ? "Thành công"
                            : log.result ===
                              "BLOCKED"
                            ? "Bị chặn"
                            : "Thất bại"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TENANT FORM
// ============================================================

function TenantForm({
  room,
  onCancel,
  onSave,
}: {
  room: Room;
  onCancel: () => void;
  onSave: (
    id: string,
    occupant: RoomOccupant
  ) => void;
}) {
  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  return (
    <Modal
      title={`Thêm người ở · Phòng ${room.roomNumber}`}
      onCancel={onCancel}
    >
      <p className="modal-help">
        Phòng {room.roomNumber} hiện có{" "}
        {room.occupants.length}/
        {room.maxOccupants} người.
        Thông tin email thuộc tài khoản
        đăng nhập và không nằm trong hồ sơ
        người ở.
      </p>

      <label>
        Họ và tên *
      </label>

      <input
        value={name}
        onChange={(event) =>
          setName(
            event.target.value
          )
        }
        placeholder="Nguyễn Văn A"
      />

      <label>
        Số điện thoại
      </label>

      <input
        value={phone}
        onChange={(event) =>
          setPhone(
            event.target.value
          )
        }
        placeholder="090..."
      />

      <div className="modal-actions">
        <button
          className="outline-button"
          onClick={onCancel}
        >
          Hủy
        </button>

        <button
          className="primary-button"
          disabled={!name.trim()}
          onClick={() =>
            onSave(room.id, {
              id: generateId(),
              roomId: room.id,
              fullName:
                name.trim(),
              phone:
                phone.trim(),
              isActive: true,
            })
          }
        >
          Lưu người ở
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// TENANT EDIT MODAL
// ============================================================

function TenantEditModal({
  room,
  tenant,
  onCancel,
  onSave,
}: {
  room: Room;
  tenant?: RoomOccupant;
  onCancel: () => void;
  onSave: (
    id: string,
    occupant: RoomOccupant
  ) => void;
}) {
  const [name, setName] =
    useState(
      tenant?.fullName ?? ""
    );

  const [phone, setPhone] =
    useState(
      tenant?.phone ?? ""
    );

  return (
    <Modal
      title={
        tenant
          ? "Chỉnh sửa người ở"
          : "Thêm người ở"
      }
      onCancel={onCancel}
    >
      <label>
        Họ và tên *
      </label>

      <input
        value={name}
        onChange={(event) =>
          setName(
            event.target.value
          )
        }
      />

      <label>
        Số điện thoại
      </label>

      <input
        value={phone}
        onChange={(event) =>
          setPhone(
            event.target.value
          )
        }
      />

      <div className="modal-actions">
        <button
          className="outline-button"
          onClick={onCancel}
        >
          Hủy
        </button>

        <button
          className="primary-button"
          disabled={!name.trim()}
          onClick={() =>
            onSave(room.id, {
              id:
                tenant?.id ??
                generateId(),
              roomId: room.id,
              fullName:
                name.trim(),
              phone:
                phone.trim(),
              isActive:
                tenant?.isActive ??
                true,
            })
          }
        >
          Lưu thay đổi
        </button>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL
// ============================================================

function Modal({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h3>
            {title}
          </h3>

          <button
            onClick={onCancel}
          >
            <X size={19} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
export type Role = "ADMIN" | "TENANT" | "CAMERA";

export type RoomStatus = "EMPTY" | "OCCUPIED";

export type DoorState = "OPEN" | "CLOSED";

export type LockState = "LOCKED" | "UNLOCKED";

export type AlarmState = "ON" | "OFF";

export type AccessResult = "SUCCESS" | "FAILED" | "BLOCKED";

export type AccessMethod =
  | "KEYPAD"
  | "WEB_PIN"
  | "PHONE_BIOMETRIC"
  | "FINGERPRINT"
  | "FACE"
  | "PASSKEY"
  | "ADMIN";

/**
 * Profile tương ứng với public.profiles
 *
 * - ADMIN  : tài khoản quản trị
 * - TENANT : tài khoản cố định của một phòng
 * - CAMERA : tài khoản của máy camera
 */
export interface Profile {
  id: string;

  roomId: string | null;

  username: string;

  email: string;

  role: Role;

  fullName: string;

  phone?: string | null;

  isActive: boolean;
}

/**
 * Người thực tế đang ở trong phòng.
 *
 * Không phải tài khoản đăng nhập.
 * Không có email/userId bắt buộc.
 *
 * Tương ứng với public.room_occupants.
 */
export interface RoomOccupant {
  id: string;

  roomId: string;

  fullName: string;

  phone: string;

  dateOfBirth?: string | null;

  identityNumber?: string | null;

  isActive: boolean;

  createdAt?: string;

  updatedAt?: string;
}

/**
 * Room tương ứng với public.rooms.
 */
export interface Room {
  id: string;

  roomNumber: string;

  floor: number;

  status: RoomStatus;

  maxOccupants: number;

  occupants: RoomOccupant[];
}

/**
 * Trạng thái cửa hiện tại.
 *
 * Tương ứng với public.door_states.
 *
 * Tên interface MainDoorState được giữ lại
 * để tránh phải sửa App.tsx ngay ở bước này.
 */
export interface MainDoorState {
  door: DoorState;

  lock: LockState;

  alarm: AlarmState;

  deviceOnline: boolean;

  updatedAt: string;
}

/**
 * Nhật ký truy cập.
 *
 * Tương ứng với public.access_logs.
 */
export interface AccessLog {
  id: string;

  time: string;

  person: string;

  roomNumber: string;

  method: AccessMethod;

  result: AccessResult;

  reason?: string | null;

  occupantId?: string | null;

  userId?: string | null;

  deviceId?: string | null;
}

/**
 * Thông báo trên giao diện.
 *
 * Database dùng:
 * INFO / SUCCESS / WARNING / ERROR
 *
 * UI hiện tại dùng chữ thường nên tạm giữ
 * type này để tránh phá giao diện.
 */
export interface Notification {
  id: string;

  text: string;

  type:
    | "info"
    | "success"
    | "warning"
    | "error";

  time: string;
}

/**
 * Camera device.
 *
 * Tương ứng với public.camera_devices.
 */
export interface CameraDevice {
  id: string;

  userId: string;

  deviceName: string;

  cameraType: "WEB_CAMERA" | "USB_CAMERA" | "IP_CAMERA";

  online: boolean;

  streaming: boolean;

  personDetected: boolean;

  personCount: number;

  detectionConfidence?: number | null;

  streamId?: string | null;

  lastSeen?: string | null;

  lastDetectionAt?: string | null;

  detectionExpiresAt?: string | null;

  createdAt?: string;

  updatedAt?: string;
}
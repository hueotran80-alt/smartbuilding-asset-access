import { Capacitor, registerPlugin } from "@capacitor/core";

type CameraPermissionResult = {
  granted: boolean;
  status: "granted" | "denied";
};

type AppPermissionsPlugin = {
  checkCameraPermission(): Promise<CameraPermissionResult>;
  requestCameraPermission(): Promise<CameraPermissionResult>;
  openAppSettings(): Promise<void>;
};

const AppPermissions = registerPlugin<AppPermissionsPlugin>("AppPermissions");

export async function requestCameraPermission(): Promise<CameraPermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: "granted" };
  }

  return AppPermissions.requestCameraPermission();
}

export async function checkCameraPermission(): Promise<CameraPermissionResult> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, status: "granted" };
  }

  return AppPermissions.checkCameraPermission();
}

export async function openAppSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await AppPermissions.openAppSettings();
  }
}

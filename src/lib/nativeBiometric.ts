import { registerPlugin } from "@capacitor/core";

export type AppLockMethod = "PIN" | "BIOMETRIC";

export interface NativeBiometricPlugin {
  isAvailable(): Promise<{ available: boolean; code: number; error?: string }>;
  authenticate(): Promise<{ success: boolean; error?: string }>;
  getAppLockMethod(options: { userId: string }): Promise<{ method: AppLockMethod | null; error?: string }>;
  saveAppLockPin(options: { userId: string; pin: string }): Promise<{ success: boolean; error?: string }>;
  verifyAppLockPin(options: { userId: string; pin: string }): Promise<{ success: boolean; error?: string }>;
  saveAppLockMethod(options: { userId: string; method: AppLockMethod }): Promise<{ success: boolean; error?: string }>;
  clearAppLock(options: { userId: string }): Promise<{ success: boolean; error?: string }>;
}

export const NativeBiometric = registerPlugin<NativeBiometricPlugin>(
  "NativeBiometric"
);

package com.smartbuilding.access;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.lifecycle.Lifecycle;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(
    name = "NativeBiometric",
    permissions = {
        @Permission(
            alias = "biometric",
            strings = { Manifest.permission.USE_BIOMETRIC }
        )
    }
)
public class NativeBiometricPlugin extends Plugin {
    private BiometricPrompt activePrompt;
    /*
     * Android native biometric unlock.
     *
     * Keep this limited to strong biometrics. DEVICE_CREDENTIAL is intentionally
     * not mixed into the prompt because the app's unlock action is specifically
     * the phone's registered fingerprint/face biometric.
     */
    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_STRONG;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        try {
            Context context = getContext();
            if (context == null) {
                resolveUnavailable(call, "Không thể truy cập thiết bị.");
                return;
            }

            BiometricManager manager = BiometricManager.from(context);
            int result = manager.canAuthenticate(AUTHENTICATORS);

            JSObject ret = new JSObject();
            ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
            ret.put("code", result);
            if (result != BiometricManager.BIOMETRIC_SUCCESS) {
                ret.put("error", getAvailabilityMessage(result));
            }
            call.resolve(ret);
        } catch (RuntimeException error) {
            resolveUnavailable(
                call,
                "Không thể kiểm tra sinh trắc học trên thiết bị."
            );
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        Context context = getContext();
        FragmentActivity activity = getActivity();

        if (context == null || activity == null || activity.isFinishing() || activity.isDestroyed()) {
            resolveFailure(call, "Ứng dụng chưa sẵn sàng để xác thực sinh trắc học.");
            return;
        }

        // BiometricPrompt cần một Activity đang RESUMED. Capacitor có thể gọi
        // plugin ngay sát thời điểm WebView resume, nên chờ ngắn trên UI thread
        // thay vì trả lỗi giả do lifecycle chưa kịp ổn định.
        Runnable openPrompt = () -> waitForResumedAndAuthenticate(call, context, activity, 0);
        if (Looper.myLooper() == Looper.getMainLooper()) {
            openPrompt.run();
        } else {
            activity.runOnUiThread(openPrompt);
        }
    }

    private void waitForResumedAndAuthenticate(PluginCall call, Context context, FragmentActivity activity, int attempt) {
        if (call.isReleased()) return;

        if (activity.isFinishing() || activity.isDestroyed()) {
            resolveFailure(call, "Ứng dụng chưa sẵn sàng để xác thực sinh trắc học.");
            return;
        }

        if (!activity.getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) {
            if (attempt >= 20) {
                resolveFailure(call, "Màn hình ứng dụng chưa sẵn sàng để mở xác thực sinh trắc học.");
                return;
            }
            activity.getWindow().getDecorView().postDelayed(
                () -> waitForResumedAndAuthenticate(call, context, activity, attempt + 1),
                50
            );
            return;
        }

        authenticateOnUiThread(call, context, activity);
    }


    private void authenticateOnUiThread(PluginCall call, Context context, FragmentActivity activity) {
        try {
            BiometricManager manager = BiometricManager.from(context);
            int availability = manager.canAuthenticate(AUTHENTICATORS);

            if (availability != BiometricManager.BIOMETRIC_SUCCESS) {
                resolveFailure(call, getAvailabilityMessage(availability));
                return;
            }

            BiometricPrompt.PromptInfo promptInfo =
                new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Mở khóa ứng dụng Smart Building")
                    .setSubtitle("Xác thực để tiếp tục vào ứng dụng")
                    // Required by AndroidX when DEVICE_CREDENTIAL is not allowed.
                    .setNegativeButtonText("Hủy")
                    .setAllowedAuthenticators(AUTHENTICATORS)
                    .setConfirmationRequired(false)
                    .build();

            if (activePrompt != null) {
                try {
                    activePrompt.cancelAuthentication();
                } catch (RuntimeException ignored) {
                }
            }

            activePrompt = new BiometricPrompt(
                activity,
                ContextCompat.getMainExecutor(context),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                        activePrompt = null;
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        resolveFailure(call, errString.toString());
                        activePrompt = null;
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // Giữ prompt mở để người dùng thử lại.
                    }
                }
            );

            activePrompt.authenticate(promptInfo);
        } catch (RuntimeException error) {
            android.util.Log.e("NativeBiometric", "Biometric prompt failed", error);
            resolveFailure(call, "Không thể mở màn hình xác thực sinh trắc học. Vui lòng thử lại.");
        }
    }

    private void resolveUnavailable(PluginCall call, String message) {
        JSObject ret = new JSObject();
        ret.put("available", false);
        ret.put("code", -1);
        ret.put("error", message);
        call.resolve(ret);
    }

    private void resolveFailure(PluginCall call, String message) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("error", message);
        call.resolve(ret);
    }

    private static final String APP_LOCK_PREFS = "smartbuilding_app_lock";
    private static final String APP_LOCK_KEY_ALIAS = "SmartBuildingAppLockAES_v1";

    private SharedPreferences getAppLockPreferences() throws Exception {
        Context context = getContext();
        if (context == null) {
            throw new IllegalStateException("Không thể truy cập bộ nhớ bảo mật của ứng dụng.");
        }
        return context.getSharedPreferences(APP_LOCK_PREFS, Context.MODE_PRIVATE);
    }

    private String appLockPreferenceKey(String prefix, String userId) throws Exception {
        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("Thiếu định danh tài khoản.");
        }
        byte[] digest = MessageDigest.getInstance("SHA-256")
            .digest(userId.getBytes(StandardCharsets.UTF_8));
        String safeUserKey = Base64.encodeToString(
            digest,
            Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
        );
        return prefix + safeUserKey;
    }

    private SecretKey getOrCreateAppLockKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        if (keyStore.containsAlias(APP_LOCK_KEY_ALIAS)) {
            return (SecretKey) keyStore.getKey(APP_LOCK_KEY_ALIAS, null);
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                APP_LOCK_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        );
        return generator.generateKey();
    }

    private String encryptAppPin(String pin) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateAppLockKey());
        byte[] encrypted = cipher.doFinal(pin.getBytes(StandardCharsets.UTF_8));
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        String ciphertext = Base64.encodeToString(encrypted, Base64.NO_WRAP);
        return iv + ":" + ciphertext;
    }

    private String decryptAppPin(String payload) throws Exception {
        String[] parts = payload.split(":", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Dữ liệu PIN được lưu không hợp lệ.");
        }
        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateAppLockKey(),
            new GCMParameterSpec(128, iv)
        );
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void getAppLockMethod(PluginCall call) {
        try {
            String userId = call.getString("userId");
            String method = getAppLockPreferences().getString(
                appLockPreferenceKey("method_", userId),
                null
            );
            JSObject ret = new JSObject();
            ret.put("method", method);
            call.resolve(ret);
        } catch (Exception error) {
            android.util.Log.e("NativeBiometric", "Could not read app lock settings", error);
            JSObject ret = new JSObject();
            ret.put("method", (String) null);
            ret.put("error", "Không thể đọc cài đặt bảo mật ứng dụng.");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void saveAppLockPin(PluginCall call) {
        try {
            String userId = call.getString("userId");
            String pin = call.getString("pin");
            if (pin == null || !pin.matches("\\d{4,8}")) {
                resolveAppLockResult(call, false, "PIN ứng dụng phải gồm từ 4 đến 8 chữ số.");
                return;
            }

            SharedPreferences preferences = getAppLockPreferences();
            String pinKey = appLockPreferenceKey("pin_", userId);
            String methodKey = appLockPreferenceKey("method_", userId);
            String encryptedPin = encryptAppPin(pin);
            boolean saved = preferences.edit()
                .putString(pinKey, encryptedPin)
                .putString(methodKey, "PIN")
                .remove(appLockPreferenceKey("failcount_", userId))
                .remove(appLockPreferenceKey("lockuntil_", userId))
                .commit();

            resolveAppLockResult(
                call,
                saved,
                saved ? null : "Không thể lưu PIN an toàn trên thiết bị."
            );
        } catch (Exception error) {
            android.util.Log.e("NativeBiometric", "Could not save app lock PIN", error);
            resolveAppLockResult(call, false, "Không thể lưu PIN an toàn trên thiết bị.");
        }
    }

    @PluginMethod
    public void verifyAppLockPin(PluginCall call) {
        try {
            String userId = call.getString("userId");
            String pin = call.getString("pin");
            if (pin == null || !pin.matches("\\d{4,8}")) {
                resolveAppLockResult(call, false, "PIN phải gồm từ 4 đến 8 chữ số.");
                return;
            }

            SharedPreferences preferences = getAppLockPreferences();
            String pinKey = appLockPreferenceKey("pin_", userId);
            String encryptedPin = preferences.getString(pinKey, null);
            if (encryptedPin == null) {
                resolveAppLockResult(call, false, "Tài khoản chưa thiết lập PIN ứng dụng.");
                return;
            }

            String failuresKey = appLockPreferenceKey("failcount_", userId);
            String lockUntilKey = appLockPreferenceKey("lockuntil_", userId);
            long now = System.currentTimeMillis();
            long lockUntil = preferences.getLong(lockUntilKey, 0L);
            if (now < lockUntil) {
                long secondsRemaining = Math.max(1L, (lockUntil - now + 999L) / 1000L);
                resolveAppLockResult(
                    call,
                    false,
                    "Đã nhập sai PIN quá nhiều lần. Thử lại sau " + secondsRemaining + " giây."
                );
                return;
            }

            byte[] expected = decryptAppPin(encryptedPin).getBytes(StandardCharsets.UTF_8);
            byte[] actual = pin.getBytes(StandardCharsets.UTF_8);
            boolean matches = MessageDigest.isEqual(expected, actual);

            if (matches) {
                preferences.edit()
                    .remove(failuresKey)
                    .remove(lockUntilKey)
                    .apply();
                resolveAppLockResult(call, true, null);
                return;
            }

            int failures = preferences.getInt(failuresKey, 0) + 1;
            SharedPreferences.Editor editor = preferences.edit();
            if (failures >= 5) {
                editor.putInt(failuresKey, 0)
                    .putLong(lockUntilKey, now + 30_000L)
                    .apply();
                resolveAppLockResult(
                    call,
                    false,
                    "Đã nhập sai PIN 5 lần. Tạm khóa trong 30 giây."
                );
                return;
            }

            editor.putInt(failuresKey, failures).apply();
            resolveAppLockResult(
                call,
                false,
                "PIN ứng dụng không đúng. Còn " + (5 - failures) + " lần thử."
            );
        } catch (Exception error) {
            android.util.Log.e("NativeBiometric", "Could not verify app lock PIN", error);
            resolveAppLockResult(call, false, "Không thể xác minh PIN trên thiết bị.");
        }
    }

    @PluginMethod
    public void clearAppLock(PluginCall call) {
        try {
            String userId = call.getString("userId");
            SharedPreferences preferences = getAppLockPreferences();
            boolean cleared = preferences.edit()
                .remove(appLockPreferenceKey("pin_", userId))
                .remove(appLockPreferenceKey("method_", userId))
                .remove(appLockPreferenceKey("failcount_", userId))
                .remove(appLockPreferenceKey("lockuntil_", userId))
                .commit();
            resolveAppLockResult(
                call,
                cleared,
                cleared ? null : "Không thể xóa cài đặt khóa ứng dụng."
            );
        } catch (Exception error) {
            android.util.Log.e("NativeBiometric", "Could not clear app lock", error);
            resolveAppLockResult(call, false, "Không thể xóa cài đặt khóa ứng dụng.");
        }
    }

    @PluginMethod
    public void saveAppLockMethod(PluginCall call) {
        try {
            String userId = call.getString("userId");
            String method = call.getString("method");
            if (!"PIN".equals(method) && !"BIOMETRIC".equals(method)) {
                resolveAppLockResult(call, false, "Phương thức bảo vệ ứng dụng không hợp lệ.");
                return;
            }

            SharedPreferences preferences = getAppLockPreferences();
            String methodKey = appLockPreferenceKey("method_", userId);
            SharedPreferences.Editor editor = preferences.edit();

            if ("PIN".equals(method)) {
                String pin = preferences.getString(appLockPreferenceKey("pin_", userId), null);
                if (pin == null) {
                    resolveAppLockResult(call, false, "Hãy thiết lập PIN ứng dụng trước.");
                    return;
                }
            } else {
                editor.remove(appLockPreferenceKey("pin_", userId));
            }

            boolean saved = editor.putString(methodKey, method).commit();
            resolveAppLockResult(
                call,
                saved,
                saved ? null : "Không thể lưu phương thức bảo vệ ứng dụng."
            );
        } catch (Exception error) {
            android.util.Log.e("NativeBiometric", "Could not save app lock method", error);
            resolveAppLockResult(call, false, "Không thể lưu phương thức bảo vệ ứng dụng.");
        }
    }

    private void resolveAppLockResult(PluginCall call, boolean success, String error) {
        JSObject ret = new JSObject();
        ret.put("success", success);
        if (error != null) {
            ret.put("error", error);
        }
        call.resolve(ret);
    }

    private String getAvailabilityMessage(int code) {
        switch (code) {
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "Thiết bị không có cảm biến sinh trắc học.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "Cảm biến sinh trắc học hiện không khả dụng.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "Thiết bị chưa đăng ký vân tay hoặc khuôn mặt.";
            default:
                return "Thiết bị chưa sẵn sàng cho xác thực sinh trắc học (mã " + code + ").";
        }
    }
}

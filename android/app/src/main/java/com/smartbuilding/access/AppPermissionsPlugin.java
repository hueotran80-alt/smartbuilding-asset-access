package com.smartbuilding.access;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(
    name = "AppPermissions",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class AppPermissionsPlugin extends Plugin {
    @PluginMethod
    public void checkCameraPermission(PluginCall call) {
        call.resolve(cameraStatus());
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        if (hasCameraPermission()) {
            call.resolve(cameraStatus());
            return;
        }

        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        call.resolve(cameraStatus());
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        getActivity().startActivity(intent);
        call.resolve();
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject cameraStatus() {
        JSObject result = new JSObject();
        boolean granted = hasCameraPermission();
        result.put("granted", granted);
        result.put("status", granted ? "granted" : "denied");
        return result;
    }
}

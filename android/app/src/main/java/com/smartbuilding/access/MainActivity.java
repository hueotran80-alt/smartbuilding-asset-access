package com.smartbuilding.access;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPermissionsPlugin.class);
        registerPlugin(BackgroundDoorMonitorPlugin.class);
        registerPlugin(NativeBiometricPlugin.class);
        super.onCreate(savedInstanceState);

        // Cho phép âm thanh phát khi sự kiện xác thực/cửa đến từ Realtime,
        // WebAuthn hoặc các callback bất đồng bộ chứ không chỉ sau một lần chạm.
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Older APKs registered a PWA service worker that could keep serving the
        // previous black UI after an APK update. On this asset version only,
        // unregister stale workers, clear their Cache Storage, then reload once.
        // This preserves localStorage (including the Supabase session and app PIN metadata).
        clearObsoletePwaCacheOnce(webView);
    }

    private void clearObsoletePwaCacheOnce(final WebView webView) {
        final String script =
            "(function(){" +
            "function runCleanup(){" +
            "if(document.readyState!=='complete'){setTimeout(runCleanup,250);return;}" +
            "var key='smartbuilding.native.asset.version';var version='1.4.1';" +
            "try{" +
            "if(localStorage.getItem(key)===version)return;" +
            "var tasks=[];" +
            "if(navigator.serviceWorker){tasks.push(navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(reg){return reg.unregister();}));}));}" +
            "if(window.caches){tasks.push(window.caches.keys().then(function(keys){return Promise.all(keys.map(function(cacheKey){return window.caches.delete(cacheKey);}));}));}" +
            "Promise.all(tasks.map(function(task){return task.catch(function(){return null;});})).then(function(){localStorage.setItem(key,version);window.location.replace(window.location.pathname+'?nativeAssetVersion='+version);},function(){localStorage.setItem(key,version);window.location.replace(window.location.pathname+'?nativeAssetVersion='+version);});" +
            "}catch(error){console.error('Native cache cleanup failed',error);}" +
            "}" +
            "runCleanup();" +
            "})();";

        webView.postDelayed(new Runnable() {
            private int attempts = 0;

            @Override
            public void run() {
                String url = webView.getUrl();
                if (url == null || !url.startsWith("https://localhost")) {
                    if (++attempts < 120) webView.postDelayed(this, 250);
                    return;
                }
                webView.evaluateJavascript(script, null);
            }
        }, 1000);
    }
}

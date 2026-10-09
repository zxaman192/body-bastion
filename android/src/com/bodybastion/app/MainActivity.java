package com.bodybastion.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Body Bastion for Android: a full-screen WebView around the hosted game.
 * The bundled splash page plays the intro while the server wakes up (free hosting sleeps when idle),
 * then hands over to the live game. Links to other sites open in the browser.
 */
public class MainActivity extends Activity {
    static final String SITE = "https://body-bastion.onrender.com/";
    static final String HOST = "body-bastion.onrender.com";
    static final String GAME_URL = SITE + "?nointro&app=android#/home";
    static final String SPLASH = "file:///android_asset/splash.html";
    static final String OFFLINE = "file:///android_asset/offline.html";

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean serverReady = false;
    private volatile boolean polling = false;
    private boolean splashLoaded = false;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("bodybastion", MODE_PRIVATE);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        w.setStatusBarColor(Color.parseColor("#1a0510"));
        w.setNavigationBarColor(Color.parseColor("#1a0510"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1a0510"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " BodyBastionApp/1.3");

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith(SPLASH)) {
                    splashLoaded = true;
                    if (serverReady) signalReady();
                } else if (url != null && url.contains(HOST)) {
                    prefs.edit().putBoolean("introSeen", true).apply();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && request.getUrl() != null && HOST.equals(request.getUrl().getHost())) {
                    view.loadUrl(OFFLINE);
                }
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> openExternal(Uri.parse(url)));

        setContentView(web);
        goImmersive();

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            boolean seen = prefs.getBoolean("introSeen", false);
            web.loadUrl(SPLASH + "?seen=" + (seen ? "1" : "0") + "#" + Uri.encode(GAME_URL));
        }
        startServerPoll();
    }

    private boolean handleUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if ("file".equals(scheme) && uri.toString().startsWith("file:///android_asset/")) return false;
        if (("https".equals(scheme) || "http".equals(scheme)) && HOST.equals(uri.getHost())) return false;
        if ("bodybastion".equals(scheme)) {
            if ("retry".equals(uri.getHost())) {
                serverReady = false;
                splashLoaded = false;
                web.loadUrl(SPLASH + "?seen=1#" + Uri.encode(GAME_URL));
                startServerPoll();
            }
            return true;
        }
        openExternal(uri);
        return true;
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // nothing can open it; stay in the game
        }
    }

    /** Wake the server (free hosting sleeps after 15 idle minutes) and tell the splash page when it answers. */
    private void startServerPoll() {
        if (polling || serverReady) return;
        polling = true;
        new Thread(() -> {
            long until = System.currentTimeMillis() + 150_000;
            while (!serverReady && System.currentTimeMillis() < until && !isFinishing()) {
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(SITE + "healthz").openConnection();
                    c.setConnectTimeout(10_000);
                    c.setReadTimeout(60_000);
                    c.setUseCaches(false);
                    if (c.getResponseCode() == 200) {
                        serverReady = true;
                        break;
                    }
                } catch (Exception ignored) {
                    // still asleep or no network: try again
                } finally {
                    if (c != null) c.disconnect();
                }
                try { Thread.sleep(2500); } catch (InterruptedException e) { break; }
            }
            polling = false;
            ui.post(() -> {
                if (web == null) return;
                if (serverReady) {
                    if (splashLoaded) signalReady();
                } else if (web != null && web.getUrl() != null && web.getUrl().startsWith(SPLASH)) {
                    web.loadUrl(OFFLINE);
                }
            });
        }, "server-wake").start();
    }

    private void signalReady() {
        if (web == null) return;
        web.evaluateJavascript("window.bbReady && window.bbReady()", null);
    }

    private void goImmersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) goImmersive();
    }

    @Override
    public void onBackPressed() {
        String url = web.getUrl();
        boolean atHome = url == null || url.startsWith("file:") || url.endsWith("#/home") || url.endsWith("#/login");
        if (!atHome && web.canGoBack()) {
            web.goBack();
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("Leave Body Bastion?")
            .setMessage("Your base keeps producing ATP and nutrients while you are away.")
            .setPositiveButton("Leave", (d, i) -> finish())
            .setNegativeButton("Stay", null)
            .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        goImmersive();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}

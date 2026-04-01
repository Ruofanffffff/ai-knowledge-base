package com.shisi.app.v2;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.shisi.app.v2.plugins.AudioRecordPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AudioRecordPlugin.class);
        super.onCreate(savedInstanceState);
        setupFullScreenImmersive();
    }

    private void setupFullScreenImmersive() {
        Window window = getWindow();
        
        // 1. 设置状态栏透明
        window.setStatusBarColor(Color.TRANSPARENT);
        
        // 2. 让内容延伸到状态栏和导航栏区域 (Edge-to-Edge)
        WindowCompat.setDecorFitsSystemWindows(window, false);
        
        // 3. 兼容旧版本 API (可选，但在 Capacitor 中通常需要)
        window.getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | 
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }
}

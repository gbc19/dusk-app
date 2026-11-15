package com.example.dusk.prototype;

import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        registerPlugin(DuskMapsConfigPlugin.class);
        super.load();
        if (getBridge().getWebView().getParent() instanceof View parent) {
            parent.setBackgroundColor(0xFF111014);
        }
    }
}

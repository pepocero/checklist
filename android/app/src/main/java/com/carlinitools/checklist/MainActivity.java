package com.carlinitools.checklist;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SaveToDownloadsPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(ShareImportPlugin.class);
        super.onCreate(savedInstanceState);
        captureSharedText(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureSharedText(intent);
    }

    private void captureSharedText(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        String type = intent.getType();
        if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("text/")) {
            String shared = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (shared != null && !shared.trim().isEmpty()) {
                WidgetDataStore.setPendingSharedText(this, shared);
            }
        }
    }
}

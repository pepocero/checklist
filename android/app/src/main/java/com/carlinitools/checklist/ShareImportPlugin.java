package com.carlinitools.checklist;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShareImport")
public class ShareImportPlugin extends Plugin {

    @PluginMethod
    public void getPendingSharedText(PluginCall call) {
        JSObject result = new JSObject();
        result.put("text", WidgetDataStore.getPendingSharedText(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void clearPendingSharedText(PluginCall call) {
        WidgetDataStore.clearPendingSharedText(getContext());
        call.resolve();
    }
}

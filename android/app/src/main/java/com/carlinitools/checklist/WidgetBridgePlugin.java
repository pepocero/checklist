package com.carlinitools.checklist;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void syncSnapshot(PluginCall call) {
        JSObject snapshot = call.getObject("snapshot");
        if (snapshot == null) {
            call.reject("snapshot es obligatorio");
            return;
        }

        Context context = getContext();
        WidgetDataStore.saveSnapshot(context, snapshot.toString());
        refreshWidgets(context);
        call.resolve();
    }

    @PluginMethod
    public void getPendingToggles(PluginCall call) {
        JSArray toggles = new JSArray();
        try {
            JSONArray raw = new JSONArray(WidgetDataStore.getPendingTogglesJson(getContext()));
            for (int i = 0; i < raw.length(); i++) {
                JSONObject item = raw.getJSONObject(i);
                JSObject toggle = new JSObject();
                toggle.put("taskId", item.optString("taskId", ""));
                toggle.put("completed", item.optBoolean("completed", false));
                toggles.put(toggle);
            }
        } catch (JSONException ignored) {
            // cola vacía o inválida
        }
        JSObject result = new JSObject();
        result.put("toggles", toggles);
        call.resolve(result);
    }

    @PluginMethod
    public void clearPendingToggles(PluginCall call) {
        WidgetDataStore.clearPendingToggles(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getSelectedListId(PluginCall call) {
        JSObject result = new JSObject();
        result.put("listId", WidgetDataStore.getSelectedListId(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void setSelectedListId(PluginCall call) {
        String listId = call.getString("listId");
        WidgetDataStore.setSelectedListId(getContext(), listId);
        refreshWidgets(getContext());
        call.resolve();
    }

    static void refreshWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, ChecklistAppWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids.length > 0) {
            ChecklistAppWidgetProvider.updateAll(context, manager, ids);
        }
    }
}

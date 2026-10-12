package com.carlinitools.checklist;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class WidgetDataStore {
    private static final String PREFS = "checklist_widget_store";
    private static final String KEY_SNAPSHOT = "snapshot_json";
    private static final String KEY_PENDING_TOGGLES = "pending_toggles_json";
    private static final String KEY_SELECTED_LIST = "selected_list_id";
    private static final String KEY_PENDING_SHARE = "pending_shared_text";

    private WidgetDataStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void saveSnapshot(Context context, String snapshotJson) {
        prefs(context).edit().putString(KEY_SNAPSHOT, snapshotJson).apply();
    }

    static String getSnapshot(Context context) {
        return prefs(context).getString(KEY_SNAPSHOT, "{\"lists\":[],\"tasks\":[],\"updatedAt\":0}");
    }

    static void setSelectedListId(Context context, String listId) {
        SharedPreferences.Editor editor = prefs(context).edit();
        if (listId == null || listId.isEmpty()) {
            editor.remove(KEY_SELECTED_LIST);
        } else {
            editor.putString(KEY_SELECTED_LIST, listId);
        }
        editor.apply();
    }

    static String getSelectedListId(Context context) {
        return prefs(context).getString(KEY_SELECTED_LIST, null);
    }

    static void appendPendingToggle(Context context, String taskId, boolean completed) {
        try {
            JSONArray toggles = new JSONArray(prefs(context).getString(KEY_PENDING_TOGGLES, "[]"));
            JSONObject item = new JSONObject();
            item.put("taskId", taskId);
            item.put("completed", completed);
            toggles.put(item);
            prefs(context).edit().putString(KEY_PENDING_TOGGLES, toggles.toString()).apply();
        } catch (JSONException ignored) {
            // ignore malformed queue
        }
    }

    static String getPendingTogglesJson(Context context) {
        return prefs(context).getString(KEY_PENDING_TOGGLES, "[]");
    }

    static void clearPendingToggles(Context context) {
        prefs(context).edit().putString(KEY_PENDING_TOGGLES, "[]").apply();
    }

    static void setPendingSharedText(Context context, String text) {
        SharedPreferences.Editor editor = prefs(context).edit();
        if (text == null || text.trim().isEmpty()) {
            editor.remove(KEY_PENDING_SHARE);
        } else {
            editor.putString(KEY_PENDING_SHARE, text);
        }
        editor.apply();
    }

    static String getPendingSharedText(Context context) {
        return prefs(context).getString(KEY_PENDING_SHARE, null);
    }

    static void clearPendingSharedText(Context context) {
        prefs(context).edit().remove(KEY_PENDING_SHARE).apply();
    }

    static void applyOptimisticToggle(Context context, String taskId, boolean completed) {
        try {
            JSONObject snapshot = new JSONObject(getSnapshot(context));
            JSONArray tasks = snapshot.optJSONArray("tasks");
            if (tasks == null) {
                return;
            }
            String listId = null;
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.getJSONObject(i);
                if (taskId.equals(task.optString("id"))) {
                    task.put("completed", completed);
                    listId = task.optString("listId", null);
                    break;
                }
            }
            if (listId != null) {
                JSONArray lists = snapshot.optJSONArray("lists");
                if (lists != null) {
                    for (int i = 0; i < lists.length(); i++) {
                        JSONObject list = lists.getJSONObject(i);
                        if (listId.equals(list.optString("id"))) {
                            int total = 0;
                            int done = 0;
                            for (int t = 0; t < tasks.length(); t++) {
                                JSONObject task = tasks.getJSONObject(t);
                                if (!listId.equals(task.optString("listId"))) {
                                    continue;
                                }
                                if (!"task".equals(task.optString("kind", "task"))) {
                                    continue;
                                }
                                total += 1;
                                if (task.optBoolean("completed", false)) {
                                    done += 1;
                                }
                            }
                            list.put("totalTasks", total);
                            list.put("completedTasks", done);
                            break;
                        }
                    }
                }
            }
            snapshot.put("updatedAt", System.currentTimeMillis());
            saveSnapshot(context, snapshot.toString());
        } catch (JSONException ignored) {
            // ignore
        }
    }
}

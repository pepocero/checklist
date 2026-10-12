package com.carlinitools.checklist;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class ChecklistAppWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_TOGGLE = "com.carlinitools.checklist.WIDGET_TOGGLE";
    public static final String EXTRA_TASK_ID = "taskId";
    public static final String EXTRA_COMPLETED = "completed";
    private static final int MAX_TASKS = 8;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAll(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_TOGGLE.equals(intent.getAction())) {
            String taskId = intent.getStringExtra(EXTRA_TASK_ID);
            boolean completed = intent.getBooleanExtra(EXTRA_COMPLETED, false);
            if (taskId != null && !taskId.isEmpty()) {
                WidgetDataStore.appendPendingToggle(context, taskId, completed);
                WidgetDataStore.applyOptimisticToggle(context, taskId, completed);
                AppWidgetManager manager = AppWidgetManager.getInstance(context);
                int[] ids = manager.getAppWidgetIds(
                    new android.content.ComponentName(context, ChecklistAppWidgetProvider.class)
                );
                updateAll(context, manager, ids);
            }
        }
    }

    static void updateAll(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            manager.updateAppWidget(appWidgetId, buildViews(context, appWidgetId));
        }
    }

    private static RemoteViews buildViews(Context context, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.checklist_widget);
        JSONObject list = resolveList(context);
        int[] rowIds = {
            R.id.widget_task_0,
            R.id.widget_task_1,
            R.id.widget_task_2,
            R.id.widget_task_3,
            R.id.widget_task_4,
            R.id.widget_task_5,
            R.id.widget_task_6,
            R.id.widget_task_7
        };
        int[] checkIds = {
            R.id.widget_check_0,
            R.id.widget_check_1,
            R.id.widget_check_2,
            R.id.widget_check_3,
            R.id.widget_check_4,
            R.id.widget_check_5,
            R.id.widget_check_6,
            R.id.widget_check_7
        };
        int[] textIds = {
            R.id.widget_text_0,
            R.id.widget_text_1,
            R.id.widget_text_2,
            R.id.widget_text_3,
            R.id.widget_text_4,
            R.id.widget_text_5,
            R.id.widget_text_6,
            R.id.widget_text_7
        };

        for (int rowId : rowIds) {
            views.setViewVisibility(rowId, View.GONE);
        }

        if (list == null) {
            views.setTextViewText(R.id.widget_title, "Checklist");
            views.setTextViewText(R.id.widget_subtitle, "Abre la app para sincronizar");
            views.setOnClickPendingIntent(
                R.id.widget_header,
                openAppPendingIntent(context, appWidgetId, "/app")
            );
            return views;
        }

        String listId = list.optString("id", "");
        String name = list.optString("name", "Lista");
        int total = list.optInt("totalTasks", 0);
        int done = list.optInt("completedTasks", 0);
        views.setTextViewText(R.id.widget_title, name);
        views.setTextViewText(R.id.widget_subtitle, done + "/" + total);
        views.setOnClickPendingIntent(
            R.id.widget_header,
            openAppPendingIntent(context, appWidgetId, "/lista/" + listId)
        );

        JSONArray tasks = tasksForList(context, listId);
        int shown = 0;
        for (int i = 0; i < tasks.length() && shown < MAX_TASKS; i++) {
            JSONObject task = tasks.optJSONObject(i);
            if (task == null) {
                continue;
            }
            String taskId = task.optString("id", "");
            String text = task.optString("text", "");
            boolean completed = task.optBoolean("completed", false);
            if (taskId.isEmpty() || text.isEmpty()) {
                continue;
            }

            views.setViewVisibility(rowIds[shown], View.VISIBLE);
            views.setTextViewText(textIds[shown], text);
            views.setImageViewResource(
                checkIds[shown],
                completed ? R.drawable.widget_check_on : R.drawable.widget_check_off
            );
            Intent toggleIntent = new Intent(context, ChecklistAppWidgetProvider.class);
            toggleIntent.setAction(ACTION_TOGGLE);
            toggleIntent.putExtra(EXTRA_TASK_ID, taskId);
            toggleIntent.putExtra(EXTRA_COMPLETED, !completed);
            toggleIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            toggleIntent.setData(Uri.parse("checklist-widget://toggle/" + taskId + "/" + shown));
            PendingIntent togglePending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 100 + shown,
                toggleIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(checkIds[shown], togglePending);
            views.setOnClickPendingIntent(
                textIds[shown],
                openAppPendingIntent(context, appWidgetId * 1000 + shown, "/lista/" + listId)
            );
            shown += 1;
        }

        return views;
    }

    private static PendingIntent openAppPendingIntent(Context context, int requestCode, String path) {
        String normalized = path.startsWith("/") ? path : "/" + path;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("checklist://app" + normalized));
        intent.setClass(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static JSONObject resolveList(Context context) {
        try {
            JSONObject snapshot = new JSONObject(WidgetDataStore.getSnapshot(context));
            JSONArray lists = snapshot.optJSONArray("lists");
            if (lists == null || lists.length() == 0) {
                return null;
            }
            String selected = WidgetDataStore.getSelectedListId(context);
            if (selected != null) {
                for (int i = 0; i < lists.length(); i++) {
                    JSONObject list = lists.optJSONObject(i);
                    if (list != null && selected.equals(list.optString("id"))) {
                        return list;
                    }
                }
            }
            JSONObject best = null;
            int bestOrder = Integer.MAX_VALUE;
            for (int i = 0; i < lists.length(); i++) {
                JSONObject list = lists.optJSONObject(i);
                if (list == null) {
                    continue;
                }
                int order = list.optInt("order", i);
                if (best == null || order < bestOrder) {
                    best = list;
                    bestOrder = order;
                }
            }
            return best;
        } catch (Exception e) {
            return null;
        }
    }

    private static JSONArray tasksForList(Context context, String listId) {
        JSONArray result = new JSONArray();
        try {
            JSONObject snapshot = new JSONObject(WidgetDataStore.getSnapshot(context));
            JSONArray tasks = snapshot.optJSONArray("tasks");
            if (tasks == null) {
                return result;
            }
            for (int i = 0; i < tasks.length(); i++) {
                JSONObject task = tasks.optJSONObject(i);
                if (task == null) {
                    continue;
                }
                if (!listId.equals(task.optString("listId"))) {
                    continue;
                }
                if (!"task".equals(task.optString("kind", "task"))) {
                    continue;
                }
                result.put(task);
            }
            // Sort by order
            JSONArray sorted = new JSONArray();
            while (sorted.length() < result.length()) {
                int bestIndex = -1;
                int bestOrder = Integer.MAX_VALUE;
                for (int i = 0; i < result.length(); i++) {
                    JSONObject task = result.getJSONObject(i);
                    boolean used = false;
                    for (int s = 0; s < sorted.length(); s++) {
                        if (sorted.getJSONObject(s).optString("id").equals(task.optString("id"))) {
                            used = true;
                            break;
                        }
                    }
                    if (used) {
                        continue;
                    }
                    int order = task.optInt("order", i);
                    if (bestIndex < 0 || order < bestOrder) {
                        bestIndex = i;
                        bestOrder = order;
                    }
                }
                if (bestIndex >= 0) {
                    sorted.put(result.getJSONObject(bestIndex));
                } else {
                    break;
                }
            }
            return sorted;
        } catch (Exception e) {
            return result;
        }
    }
}

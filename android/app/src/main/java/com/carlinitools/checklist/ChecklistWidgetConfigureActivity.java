package com.carlinitools.checklist;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.TextView;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

public class ChecklistWidgetConfigureActivity extends Activity {
    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final ArrayList<String> listIds = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);

        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            );
        }

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        setContentView(R.layout.checklist_widget_configure);
        TextView empty = findViewById(R.id.widget_config_empty);
        ListView listView = findViewById(R.id.widget_config_list);

        ArrayList<String> labels = new ArrayList<>();
        try {
            JSONObject snapshot = new JSONObject(WidgetDataStore.getSnapshot(this));
            JSONArray lists = snapshot.optJSONArray("lists");
            if (lists != null) {
                for (int i = 0; i < lists.length(); i++) {
                    JSONObject list = lists.optJSONObject(i);
                    if (list == null) {
                        continue;
                    }
                    listIds.add(list.optString("id"));
                    labels.add(list.optString("name", "Lista"));
                }
            }
        } catch (Exception ignored) {
            // empty
        }

        if (labels.isEmpty()) {
            empty.setVisibility(View.VISIBLE);
            listView.setVisibility(View.GONE);
            return;
        }

        empty.setVisibility(View.GONE);
        listView.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, labels));
        listView.setOnItemClickListener(
            (AdapterView<?> parent, View view, int position, long id) -> {
                String listId = listIds.get(position);
                WidgetDataStore.setSelectedListId(this, listId);
                AppWidgetManager manager = AppWidgetManager.getInstance(this);
                ChecklistAppWidgetProvider.updateAll(this, manager, new int[] { appWidgetId });

                Intent result = new Intent();
                result.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
                setResult(RESULT_OK, result);
                finish();
            }
        );
    }
}

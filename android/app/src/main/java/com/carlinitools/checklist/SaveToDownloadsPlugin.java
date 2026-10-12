package com.carlinitools.checklist;

import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SaveToDownloads")
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");

        if (fileName == null || fileName.isEmpty() || content == null) {
            call.reject("fileName y content son obligatorios");
            return;
        }

        try {
            String uriString;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri uri = getContext()
                    .getContentResolver()
                    .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (uri == null) {
                    call.reject("No se pudo crear el archivo en Descargas");
                    return;
                }

                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                    if (out == null) {
                        call.reject("No se pudo escribir el archivo en Descargas");
                        return;
                    }
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }

                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, values, null, null);
                uriString = uri.toString();
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("No se pudo acceder a la carpeta Descargas");
                    return;
                }

                File file = new File(dir, fileName);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }

                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { file.getAbsolutePath() },
                    new String[] { "application/json" },
                    null
                );
                uriString = Uri.fromFile(file).toString();
            }

            JSObject result = new JSObject();
            result.put("uri", uriString);
            result.put("fileName", fileName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo guardar en Descargas: " + e.getMessage(), e);
        }
    }
}

package be.barlicious.visitfence;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class VisitFencePoster {
    static final String PREFS = "visit_fence";

    private VisitFencePoster() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void post(Context context, Location location, boolean dwell, boolean exit) {
        SharedPreferences prefs = prefs(context);
        if (prefs.getBoolean("paused", false)) return;
        if (prefs.getLong("until", 0) < System.currentTimeMillis()) return;
        String api = prefs.getString("api", "");
        String apiKey = prefs.getString("key", "");
        String refresh = prefs.getString("refresh", "");
        if (api == null || apiKey == null || refresh == null || api.isEmpty() || apiKey.isEmpty() || refresh.isEmpty() || location == null) return;
        try {
            String tokenBody = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8");
            JSONObject token = request("https://securetoken.googleapis.com/v1/token?key=" + apiKey, tokenBody, "application/x-www-form-urlencoded", null);
            String idToken = token.optString("id_token", "");
            if (idToken.isEmpty()) return;
            if (token.has("refresh_token")) prefs.edit().putString("refresh", token.getString("refresh_token")).apply();
            JSONObject input = new JSONObject();
            input.put("confirmedDwell", dwell);
            input.put("confirmedExit", exit);
            JSONObject point = new JSONObject();
            point.put("lat", location.getLatitude());
            point.put("lng", location.getLongitude());
            float accuracy = location.getAccuracy();
            point.put("accuracy", Math.min(5000, Math.max(accuracy > 0 ? accuracy : 50, 1)));
            point.put("capturedAt", location.getTime() > 0 ? location.getTime() : System.currentTimeMillis());
            input.put("location", point);
            JSONObject body = new JSONObject();
            body.put("action", "syncVisitLocation");
            body.put("input", input);
            JSONObject response = request(api, body.toString(), "application/json", "Bearer " + idToken);
            JSONObject data = response.optJSONObject("data");
            JSONArray choices = data == null ? null : data.optJSONArray("choices");
            if (choices != null && choices.length() >= 2) notifyAmbiguous(context);
        } catch (Exception ignored) {
            // The next fence event retries. Opening the app also syncs.
        }
    }

    private static void notifyAmbiguous(Context context) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(new NotificationChannel("visit-fence", "Klanttijd", NotificationManager.IMPORTANCE_HIGH));
            }
            int icon = context.getApplicationInfo().icon != 0 ? context.getApplicationInfo().icon : android.R.drawable.ic_dialog_map;
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, "visit-fence")
                : new Notification.Builder(context);
            manager.notify(57002, builder
                .setSmallIcon(icon)
                .setContentTitle("Twee klanten")
                .setContentText("Twee adressen liggen in dezelfde cirkel. Open de app en kies. We gokken niet.")
                .setAutoCancel(true)
                .build());
        } catch (Exception ignored) { /* notification permission can be off */ }
    }

    private static JSONObject request(String url, String body, String type, String authorization) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", type);
        connection.setRequestProperty("X-Team-Client", "visit-fence");
        if (authorization != null) connection.setRequestProperty("Authorization", authorization);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        try (OutputStream stream = connection.getOutputStream()) { stream.write(bytes); }
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return new JSONObject();
        return new JSONObject(read(stream));
    }

    private static String read(InputStream stream) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int count;
        while ((count = stream.read(chunk)) >= 0) buffer.write(chunk, 0, count);
        return buffer.toString("UTF-8");
    }
}

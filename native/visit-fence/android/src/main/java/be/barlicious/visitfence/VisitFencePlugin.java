package be.barlicious.visitfence;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "VisitFence",
    permissions = {
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "background"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class VisitFencePlugin extends Plugin {
    @PluginMethod
    public void arm(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "afterLocation");
            return;
        }
        if (getPermissionState("background") != PermissionState.GRANTED) {
            requestPermissionForAlias("background", call, "afterBackground");
            return;
        }
        PermissionState notifications = getPermissionState("notifications");
        if (notifications == PermissionState.PROMPT || notifications == PermissionState.PROMPT_WITH_RATIONALE) {
            requestPermissionForAlias("notifications", call, "afterNotifications");
            return;
        }
        doArm(call);
    }

    @PermissionCallback
    public void afterLocation(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Zet locatie aan, anders kan de klanttijd niet lopen.");
            return;
        }
        arm(call);
    }

    @PermissionCallback
    public void afterBackground(PluginCall call) {
        if (getPermissionState("background") != PermissionState.GRANTED) {
            call.reject("Zet locatie op Altijd, anders stopt de klanttijd als de app dicht is.");
            return;
        }
        arm(call);
    }

    @PermissionCallback
    public void afterNotifications(PluginCall call) {
        doArm(call);
    }

    @PluginMethod
    public void disarm(PluginCall call) {
        clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        VisitFencePoster.prefs(getContext()).edit().putBoolean("paused", true).putBoolean("checkExit", true).apply();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        VisitFencePoster.prefs(getContext()).edit().putBoolean("paused", false).apply();
        call.resolve();
    }

    private void doArm(PluginCall call) {
        JSArray sites = call.getArray("sites");
        Context context = getContext();
        SharedPreferences prefs = VisitFencePoster.prefs(context);
        String refresh = call.getString("refreshToken", "");
        if (sites == null || sites.length() == 0) {
            removeFences(context);
            prefs.edit().putString("sites", "[]").apply();
            call.resolve();
            return;
        }
        if (refresh == null || refresh.isEmpty()) {
            call.reject("Meld opnieuw aan in de geïnstalleerde app zodat de klanttijd ook dicht mag lopen.");
            return;
        }
        boolean checkExit = prefs.getBoolean("checkExit", false);
        prefs.edit()
            .putString("api", call.getString("apiUrl", ""))
            .putString("origin", call.getString("origin", ""))
            .putString("key", call.getString("apiKey", ""))
            .putString("refresh", refresh)
            .putLong("until", (long) call.getDouble("armedUntil", System.currentTimeMillis() + 16L * 60L * 60L * 1000L))
            .putString("sites", sites.toString())
            .putBoolean("paused", false)
            .apply();
        register(context, sites);
        if (checkExit) presence(context);
        call.resolve();
    }

    static void reregister(Context context) {
        SharedPreferences prefs = VisitFencePoster.prefs(context);
        if (prefs.getLong("until", 0) < System.currentTimeMillis()) return;
        String raw = prefs.getString("sites", "");
        if (raw == null || raw.isEmpty() || "[]".equals(raw)) return;
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        prefs.edit().putBoolean("checkExit", true).apply();
        try {
            register(context, new JSONArray(raw));
            presence(context);
        } catch (Exception ignored) { /* next clock-in re-arms */ }
    }

    private static void register(Context context, JSONArray sites) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        GeofencingClient client = LocationServices.getGeofencingClient(context);
        List<Geofence> fences = new ArrayList<>();
        long until = VisitFencePoster.prefs(context).getLong("until", 0);
        long life = Math.max(60_000, until - System.currentTimeMillis());
        for (int i = 0; i < sites.length() && fences.size() < 20; i++) {
            JSONObject site = sites.optJSONObject(i);
            if (site == null || site.optString("id").isEmpty()) continue;
            fences.add(new Geofence.Builder()
                .setRequestId(site.optString("id"))
                .setCircularRegion(site.optDouble("lat"), site.optDouble("lng"), (float) Math.max(200, site.optDouble("radius", 200)))
                .setExpirationDuration(life)
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL | Geofence.GEOFENCE_TRANSITION_EXIT)
                .setLoiteringDelay(120_000)
                .setNotificationResponsiveness(30_000)
                .build());
        }
        PendingIntent intent = pending(context);
        client.removeGeofences(intent).addOnCompleteListener(task -> {
            if (fences.isEmpty()) return;
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
            GeofencingRequest request = new GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_DWELL)
                .addGeofences(fences)
                .build();
            client.addGeofences(request, intent);
        });
    }

    private static void presence(Context context) {
        VisitFencePoster.prefs(context).edit().putBoolean("checkExit", false).apply();
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return;
        LocationServices.getFusedLocationProviderClient(context)
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener(location -> {
                if (location == null || location.getAccuracy() <= 0 || location.getAccuracy() > 100) return;
                String raw = VisitFencePoster.prefs(context).getString("sites", "[]");
                try {
                    JSONArray sites = new JSONArray(raw == null ? "[]" : raw);
                    for (int i = 0; i < sites.length(); i++) {
                        JSONObject site = sites.optJSONObject(i);
                        if (site == null) continue;
                        float[] meters = new float[1];
                        Location.distanceBetween(location.getLatitude(), location.getLongitude(), site.optDouble("lat"), site.optDouble("lng"), meters);
                        if (meters[0] <= Math.max(200, site.optDouble("radius", 200))) return;
                    }
                } catch (Exception ignored) { return; }
                new Thread(() -> VisitFencePoster.post(context.getApplicationContext(), location, false, true)).start();
            });
    }

    private static void removeFences(Context context) {
        LocationServices.getGeofencingClient(context).removeGeofences(pending(context));
    }

    private static PendingIntent pending(Context context) {
        Intent intent = new Intent(context, VisitFenceReceiver.class);
        return PendingIntent.getBroadcast(context, 57001, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    }

    private static void clear(Context context) {
        removeFences(context);
        VisitFencePoster.prefs(context).edit().clear().apply();
    }
}

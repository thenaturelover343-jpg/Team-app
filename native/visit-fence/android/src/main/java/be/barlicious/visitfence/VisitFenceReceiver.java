package be.barlicious.visitfence;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

public class VisitFenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null || event.hasError()) return;
        Location location = event.getTriggeringLocation();
        if (location == null) return;
        boolean dwell = event.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_DWELL;
        boolean exit = event.getGeofenceTransition() == Geofence.GEOFENCE_TRANSITION_EXIT;
        if (!dwell && !exit) return;
        PendingResult pending = goAsync();
        new Thread(() -> {
            try { VisitFencePoster.post(context.getApplicationContext(), location, dwell, exit); }
            finally { pending.finish(); }
        }).start();
    }
}

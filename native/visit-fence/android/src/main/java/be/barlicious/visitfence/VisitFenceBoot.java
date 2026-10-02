package be.barlicious.visitfence;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class VisitFenceBoot extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        VisitFencePlugin.reregister(context.getApplicationContext());
    }
}

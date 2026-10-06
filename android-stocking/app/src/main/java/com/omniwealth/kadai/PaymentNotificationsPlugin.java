package com.omniwealth.kadai;

import android.content.Intent;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.lang.ref.WeakReference;

/** Bridge between the payment-notification queue and the Kadai web layer. */
@CapacitorPlugin(name = "PaymentNotifications")
public class PaymentNotificationsPlugin extends Plugin {

    private static WeakReference<PaymentNotificationsPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    /** Called by the listener service when a new payment notification was queued. */
    static void notifyQueued() {
        PaymentNotificationsPlugin p = instance.get();
        if (p != null) p.notifyListeners("payment", new JSObject());
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        boolean enabled = NotificationManagerCompat
                .getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open notification access settings");
        }
    }

    @PluginMethod
    public void peek(PluginCall call) {
        try {
            JSONArray items = PaymentQueue.peek(getContext());
            JSObject ret = new JSObject();
            ret.put("items", new JSArray(items.toString()));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read the queue");
        }
    }

    @PluginMethod
    public void ack(PluginCall call) {
        Long upTo = call.getLong("upToId");
        if (upTo == null) {
            call.reject("upToId required");
            return;
        }
        PaymentQueue.ack(getContext(), upTo);
        call.resolve();
    }
}

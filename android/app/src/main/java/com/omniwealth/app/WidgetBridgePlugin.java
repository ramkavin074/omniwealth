package com.omniwealth.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the household net worth from the web app into SharedPreferences so the
 * Home Screen widget can render it, then asks the widget to refresh. The iOS
 * counterpart is WidgetBridge.swift; the JS side is src/lib/widget.ts.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setNetWorth(PluginCall call) {
        Double amount = call.getDouble("amount");
        String currency = call.getString("currency");
        if (amount == null || currency == null || currency.isEmpty()) {
            call.reject("amount (number) and currency (string) are required");
            return;
        }
        boolean hidden = Boolean.TRUE.equals(call.getBoolean("hidden", false));

        Context ctx = getContext();
        SharedPreferences.Editor e =
                ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE).edit();
        e.putLong(NetWorthWidgetProvider.KEY_AMOUNT_BITS, Double.doubleToRawLongBits(amount));
        e.putString(NetWorthWidgetProvider.KEY_CURRENCY, currency);
        e.putBoolean(NetWorthWidgetProvider.KEY_HIDDEN, hidden);
        e.putLong(NetWorthWidgetProvider.KEY_UPDATED_AT, System.currentTimeMillis());
        e.putBoolean(NetWorthWidgetProvider.KEY_HAS_DATA, true);
        e.apply();

        NetWorthWidgetProvider.refreshAll(ctx);
        call.resolve(new JSObject());
    }

    /** Background refresh: keep the read-only key in this app's private storage. */
    @PluginMethod
    public void setKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.length() < 20 || key.length() > 200) {
            call.reject("a valid key is required");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(NetWorthWidgetProvider.KEY_API_KEY, key)
                .putLong(NetWorthWidgetProvider.KEY_API_KEY_AT, System.currentTimeMillis())
                .apply();
        NetWorthRefreshWorker.schedule(ctx);
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void getKeyInfo(PluginCall call) {
        SharedPreferences p =
                getContext().getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE);
        boolean has = p.getString(NetWorthWidgetProvider.KEY_API_KEY, null) != null;
        long at = p.getLong(NetWorthWidgetProvider.KEY_API_KEY_AT, 0L);
        JSObject out = new JSObject();
        out.put("hasKey", has);
        out.put("ageDays", has && at > 0 ? (System.currentTimeMillis() - at) / 86400000L : 9999);
        call.resolve(out);
    }

    /** App lock turned on/off: hide or show the balance right away. */
    @PluginMethod
    public void setHidden(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(NetWorthWidgetProvider.KEY_HIDDEN, Boolean.TRUE.equals(call.getBoolean("hidden", false)))
                .apply();
        NetWorthWidgetProvider.refreshAll(ctx);
        call.resolve(new JSObject());
    }

    /** Called on sign-out so a stale balance, or a key, never lingers on the phone. */
    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        NetWorthRefreshWorker.cancel(ctx);
        ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        NetWorthWidgetProvider.refreshAll(ctx);
        call.resolve(new JSObject());
    }
}

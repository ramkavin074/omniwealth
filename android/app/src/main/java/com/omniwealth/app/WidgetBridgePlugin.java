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

    /** Called on sign-out so a stale balance never lingers on the Home Screen. */
    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        NetWorthWidgetProvider.refreshAll(ctx);
        call.resolve(new JSObject());
    }
}

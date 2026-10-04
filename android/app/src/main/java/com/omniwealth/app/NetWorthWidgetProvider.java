package com.omniwealth.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.text.format.DateUtils;
import android.util.TypedValue;
import android.widget.RemoteViews;

import java.util.Locale;

/** Home Screen widget showing the household net worth (value pushed by WidgetBridgePlugin). */
public class NetWorthWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "omniwealth_widget";
    static final String KEY_AMOUNT_BITS = "amountBits";
    static final String KEY_CURRENCY = "currency";
    static final String KEY_HIDDEN = "hidden";
    static final String KEY_UPDATED_AT = "updatedAt";
    static final String KEY_HAS_DATA = "hasData";
    // Read-only key for background refresh (can fetch the net worth total only).
    static final String KEY_REVEAL_UNTIL = "revealUntil";
    static final String ACTION_REHIDE = "com.omniwealth.app.WIDGET_REHIDE";
    static final long REVEAL_MS = 30_000L;
    static final String KEY_API_KEY = "apiKey";
    static final String KEY_API_KEY_AT = "apiKeyAt";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        // Time is up on a tap-to-unlock reveal: draw the locked widget again.
        if (intent != null && ACTION_REHIDE.equals(intent.getAction())) {
            refreshAll(context);
        }
    }

    @Override
    public void onEnabled(Context context) {
        if (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_API_KEY, null) != null) {
            NetWorthRefreshWorker.schedule(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        NetWorthRefreshWorker.cancel(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            update(context, manager, id);
        }
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, NetWorthWidgetProvider.class));
        for (int id : ids) {
            update(context, manager, id);
        }
    }

    private static void update(Context context, AppWidgetManager manager, int id) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_networth);
        boolean locked = false;

        if (!p.getBoolean(KEY_HAS_DATA, false)) {
            views.setTextViewTextSize(R.id.widget_amount, TypedValue.COMPLEX_UNIT_SP, 17); // fits narrow widgets
            views.setTextViewText(R.id.widget_amount, "Open OmniWealth");
            views.setTextViewText(R.id.widget_currency, "");
            views.setTextViewText(R.id.widget_updated, "Sign in to see your net worth");
        } else if (p.getBoolean(KEY_HIDDEN, false) && System.currentTimeMillis() >= p.getLong(KEY_REVEAL_UNTIL, 0L)) {
            // Locked: dots until the user taps and confirms fingerprint / face / PIN.
            views.setTextViewTextSize(R.id.widget_amount, TypedValue.COMPLEX_UNIT_SP, 26);
            views.setTextViewText(R.id.widget_amount, "\u2022\u2022\u2022\u2022\u2022\u2022");
            views.setTextViewText(R.id.widget_currency, "");
            views.setTextViewText(R.id.widget_updated, "Tap to unlock");
            locked = true;
        } else {
            double amount = Double.longBitsToDouble(p.getLong(KEY_AMOUNT_BITS, 0L));
            views.setTextViewTextSize(R.id.widget_amount, TypedValue.COMPLEX_UNIT_SP, 26);
            views.setTextViewText(R.id.widget_amount, compact(amount));
            views.setTextViewText(R.id.widget_currency, p.getString(KEY_CURRENCY, ""));
            long at = p.getLong(KEY_UPDATED_AT, 0L);
            boolean brieflyShown = p.getBoolean(KEY_HIDDEN, false);
            views.setTextViewText(
                    R.id.widget_updated,
                    brieflyShown
                            ? "Unlocked \u00b7 hides in a moment"
                            : at > 0
                                    ? "Updated " + DateUtils.getRelativeTimeSpanString(
                                            at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)
                                    : "");
        }

        if (locked) {
            Intent unlock = new Intent(context, UnlockWidgetActivity.class);
            unlock.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pi = PendingIntent.getActivity(
                    context, 2, unlock, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        } else {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                PendingIntent pi = PendingIntent.getActivity(
                        context, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                views.setOnClickPendingIntent(R.id.widget_root, pi);
            }
        }
        manager.updateAppWidget(id, views);
    }

    /** 2,364,000 -> "2.36M", 12,500 -> "12.5K", -3,200,000 -> "-3.2M". */
    static String compact(double v) {
        double abs = Math.abs(v);
        String sign = v < 0 ? "-" : "";
        if (abs >= 1e9) return sign + trim(abs / 1e9) + "B";
        if (abs >= 1e6) return sign + trim(abs / 1e6) + "M";
        if (abs >= 1e4) return sign + trim(abs / 1e3) + "K";
        return sign + String.format(Locale.US, "%,.0f", abs);
    }

    private static String trim(double x) {
        String s = String.format(Locale.US, "%.2f", x);
        if (s.contains(".")) {
            s = s.replaceAll("0+$", "").replaceAll("\\.$", "");
        }
        return s;
    }
}

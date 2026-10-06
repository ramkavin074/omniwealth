package com.omniwealth.kadai;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Small on-device queue of payment notifications. The listener service appends to it
 * (even while the app is closed); the web layer reads and acknowledges it when the app
 * is open. Nothing here leaves the phone.
 */
final class PaymentQueue {
    private static final String PREFS = "kadai_payment_queue";
    private static final String KEY_ITEMS = "items";
    private static final String KEY_NEXT_ID = "nextId";
    private static final int MAX_ITEMS = 300;
    private static final Object LOCK = new Object();

    private PaymentQueue() {}

    private static JSONArray load(SharedPreferences sp) {
        try {
            return new JSONArray(sp.getString(KEY_ITEMS, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Appends one notification unless an identical one (same app, time and text) is already queued. */
    static boolean add(Context ctx, String pkg, String title, String text, long postedAt) {
        synchronized (LOCK) {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray items = load(sp);
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.optJSONObject(i);
                if (o != null
                        && pkg.equals(o.optString("pkg"))
                        && postedAt == o.optLong("postedAt")
                        && text.equals(o.optString("text"))
                        && title.equals(o.optString("title"))) {
                    return false;
                }
            }
            long id = sp.getLong(KEY_NEXT_ID, 1L);
            try {
                JSONObject o = new JSONObject();
                o.put("id", id);
                o.put("pkg", pkg);
                o.put("title", title);
                o.put("text", text);
                o.put("postedAt", postedAt);
                items.put(o);
            } catch (JSONException e) {
                return false;
            }
            // Keep only the newest MAX_ITEMS.
            JSONArray kept = new JSONArray();
            int start = Math.max(0, items.length() - MAX_ITEMS);
            for (int i = start; i < items.length(); i++) kept.put(items.opt(i));
            sp.edit().putString(KEY_ITEMS, kept.toString()).putLong(KEY_NEXT_ID, id + 1).apply();
            return true;
        }
    }

    static JSONArray peek(Context ctx) {
        synchronized (LOCK) {
            return load(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
        }
    }

    /** Removes every item with id <= upToId (the web layer has stored them). */
    static void ack(Context ctx, long upToId) {
        synchronized (LOCK) {
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray items = load(sp);
            JSONArray kept = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.optJSONObject(i);
                if (o != null && o.optLong("id") > upToId) kept.put(o);
            }
            sp.edit().putString(KEY_ITEMS, kept.toString()).apply();
        }
    }
}

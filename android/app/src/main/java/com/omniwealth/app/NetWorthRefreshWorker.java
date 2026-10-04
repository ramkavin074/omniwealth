package com.omniwealth.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;

/**
 * Refreshes the Home Screen widget's net worth in the background, a few times a
 * day, using a read-only key that can fetch the total and nothing else. The key
 * lives only in this app's private storage and is never logged.
 */
public class NetWorthRefreshWorker extends Worker {

    static final String WORK_NAME = "omniwealth-widget-refresh";
    // Fixed on purpose: the key is only ever sent to this address.
    private static final String ENDPOINT = "https://www.omniwealth.org/api/widget/net-worth";

    public NetWorthRefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context ctx) {
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest request =
                new PeriodicWorkRequest.Builder(NetWorthRefreshWorker.class, 6, TimeUnit.HOURS)
                        .setConstraints(constraints)
                        .build();
        WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE);
        String key = prefs.getString(NetWorthWidgetProvider.KEY_API_KEY, null);
        if (key == null) {
            return Result.success();
        }

        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(ENDPOINT).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setInstanceFollowRedirects(false); // never forward the key elsewhere
            conn.setRequestProperty("Authorization", "Bearer " + key);
            conn.setRequestProperty("Accept", "application/json");

            int code = conn.getResponseCode();
            if (code == 401) {
                // Key revoked or expired (sign-out, password change, "turn off"): forget everything.
                prefs.edit().clear().apply();
                NetWorthWidgetProvider.refreshAll(ctx);
                cancel(ctx);
                return Result.success();
            }
            if (code != 200) {
                return Result.success(); // try again at the next period
            }

            StringBuilder sb = new StringBuilder();
            try (InputStream in = conn.getInputStream();
                 BufferedReader r = new BufferedReader(new InputStreamReader(in, "UTF-8"))) {
                String line;
                while ((line = r.readLine()) != null && sb.length() < 4096) {
                    sb.append(line);
                }
            }
            JSONObject json = new JSONObject(sb.toString());
            double amount = json.getDouble("amount");
            String currency = json.getString("currency");

            prefs.edit()
                    .putLong(NetWorthWidgetProvider.KEY_AMOUNT_BITS, Double.doubleToRawLongBits(amount))
                    .putString(NetWorthWidgetProvider.KEY_CURRENCY, currency)
                    .putLong(NetWorthWidgetProvider.KEY_UPDATED_AT, System.currentTimeMillis())
                    .putBoolean(NetWorthWidgetProvider.KEY_HAS_DATA, true)
                    .apply();
            NetWorthWidgetProvider.refreshAll(ctx);
            return Result.success();
        } catch (Exception e) {
            return Result.retry(); // offline or a hiccup: WorkManager backs off and retries
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}

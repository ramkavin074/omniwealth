package com.omniwealth.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

/**
 * Opened by tapping the locked Home Screen widget. Shows the system fingerprint /
 * face / PIN prompt; on success the widget reveals the net worth for 30 seconds,
 * then hides it again. Nothing is shown or stored beyond that timestamp.
 */
public class UnlockWidgetActivity extends FragmentActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock OmniWealth")
                .setSubtitle("Show your net worth on the widget for 30 seconds");
        if (Build.VERSION.SDK_INT >= 30) {
            info.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } else {
            info.setDeviceCredentialAllowed(true);
        }

        BiometricPrompt prompt = new BiometricPrompt(
                this,
                ContextCompat.getMainExecutor(this),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        reveal();
                        finish();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        if (errorCode == BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL
                                || errorCode == BiometricPrompt.ERROR_NO_BIOMETRICS) {
                            Toast.makeText(
                                            UnlockWidgetActivity.this,
                                            "Set up a screen lock on this phone to unlock the widget.",
                                            Toast.LENGTH_LONG)
                                    .show();
                        }
                        finish(); // cancelled or failed: the widget stays locked
                    }
                });
        prompt.authenticate(info.build());
    }

    private void reveal() {
        Context ctx = getApplicationContext();
        long until = System.currentTimeMillis() + NetWorthWidgetProvider.REVEAL_MS;
        ctx.getSharedPreferences(NetWorthWidgetProvider.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong(NetWorthWidgetProvider.KEY_REVEAL_UNTIL, until)
                .apply();
        NetWorthWidgetProvider.refreshAll(ctx);

        // Draw the locked widget again when the time is up. An inexact alarm needs no
        // special permission; it normally fires within a minute or so of the target.
        Intent rehide = new Intent(ctx, NetWorthWidgetProvider.class).setAction(NetWorthWidgetProvider.ACTION_REHIDE);
        PendingIntent pi = PendingIntent.getBroadcast(
                ctx, 1, rehide, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager alarms = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC, until + 1000L, pi);
        }
    }
}

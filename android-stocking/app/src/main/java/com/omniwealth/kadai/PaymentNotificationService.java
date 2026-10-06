package com.omniwealth.kadai;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Reads notifications from UPI payment apps only (PhonePe, Google Pay, Paytm, BHIM) so
 * "money received" messages can be recorded and matched to bills. Notifications from every
 * other app are ignored without being looked at. The user turns this on themselves under
 * Android Settings, Notification access.
 */
public class PaymentNotificationService extends NotificationListenerService {

    private static final String[] PAYMENT_APP_PREFIXES = {
        "com.phonepe.",
        "com.google.android.apps.nbu.paisa.",
        "net.one97.paytm",
        "com.paytm",
        "in.org.npci.upiapp",
    };

    static boolean isPaymentApp(String pkg) {
        if (pkg == null) return false;
        for (String p : PAYMENT_APP_PREFIXES) {
            if (pkg.startsWith(p)) return true;
        }
        return false;
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || !isPaymentApp(sbn.getPackageName())) return;
            Notification n = sbn.getNotification();
            if (n == null) return;
            // The collapsed summary of a notification group carries no payment of its own.
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle extras = n.extras;
            if (extras == null) return;
            String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
            String text = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (text.isEmpty()) text = str(extras.getCharSequence(Notification.EXTRA_TEXT));
            if (text.isEmpty() && title.isEmpty()) return;
            // Only notifications that mention an amount are worth keeping.
            String all = title + " " + text;
            if (!(all.contains("₹") || all.toLowerCase().contains("rs") || all.toLowerCase().contains("inr"))) return;

            boolean added = PaymentQueue.add(getApplicationContext(), sbn.getPackageName(), title, text, sbn.getPostTime());
            if (added) PaymentNotificationsPlugin.notifyQueued();
        } catch (Exception ignored) {
            // Never let a malformed notification crash the listener.
        }
    }
}

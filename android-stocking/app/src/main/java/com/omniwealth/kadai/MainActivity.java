package com.omniwealth.kadai;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PaymentNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

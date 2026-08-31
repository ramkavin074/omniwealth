package com.omniwealth.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    // NOTE: previously forced getWebView().setLayerType(LAYER_TYPE_SOFTWARE)
    // in onStart(). That disables hardware acceleration for the WebView and
    // made the Chromium renderer crash (SIGTRAP in libmonochrome) whenever a
    // native dialog — e.g. the biometric prompt — caused the WebView to
    // recomposite, which then aborted the whole app. Removed so the WebView
    // uses its default hardware layer.
}

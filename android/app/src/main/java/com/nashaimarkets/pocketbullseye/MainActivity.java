package com.nashaimarkets.pocketbullseye;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PocketPlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

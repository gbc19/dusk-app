package com.example.dusk.prototype;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DuskMapsConfig")
public class DuskMapsConfigPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject status = new JSObject();
        status.put("configured", BuildConfig.DUSK_MAPS_CONFIGURED);
        call.resolve(status);
    }
}

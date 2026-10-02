#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VisitFencePlugin, "VisitFence",
  CAP_PLUGIN_METHOD(arm, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(disarm, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(pause, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(resume, CAPPluginReturnPromise);
)

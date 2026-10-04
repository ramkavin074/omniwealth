import Foundation
import Capacitor
import WidgetKit

/// Bridges a single value — the household net worth — from the web app into the
/// shared App Group container so the Home Screen widget can render it, then
/// asks WidgetKit to refresh. Auto-registered by Capacitor at runtime.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNetWorth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.omniwealth.app"
    static let keyAmount = "netWorthAmount"
    static let keyCurrency = "netWorthCurrency"
    static let keyUpdatedAt = "netWorthUpdatedAt"
    // True while the in-app biometric lock is on: the widget and Siri then
    // show a placeholder instead of the balance.
    static let keyHidden = "netWorthHidden"

    @objc func setNetWorth(_ call: CAPPluginCall) {
        guard let amount = call.getDouble("amount"),
              let currency = call.getString("currency") else {
            call.reject("amount (number) and currency (string) are required")
            return
        }

        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroup) is not available")
            return
        }

        defaults.set(amount, forKey: WidgetBridgePlugin.keyAmount)
        defaults.set(currency, forKey: WidgetBridgePlugin.keyCurrency)
        defaults.set(call.getBool("hidden") ?? false, forKey: WidgetBridgePlugin.keyHidden)
        defaults.set(Date().timeIntervalSince1970, forKey: WidgetBridgePlugin.keyUpdatedAt)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    /// Called on sign-out so a stale balance never lingers on the Home Screen.
    @objc func clear(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroup) is not available")
            return
        }
        defaults.removeObject(forKey: WidgetBridgePlugin.keyAmount)
        defaults.removeObject(forKey: WidgetBridgePlugin.keyCurrency)
        defaults.removeObject(forKey: WidgetBridgePlugin.keyUpdatedAt)
        defaults.removeObject(forKey: WidgetBridgePlugin.keyHidden)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}

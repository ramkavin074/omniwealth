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
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getKeyInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHidden", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.omniwealth.app"
    static let keyAmount = "netWorthAmount"
    static let keyCurrency = "netWorthCurrency"
    static let keyUpdatedAt = "netWorthUpdatedAt"
    // True while the in-app biometric lock is on: the widget and Siri then
    // show a placeholder instead of the balance.
    static let keyHidden = "netWorthHidden"
    // Read-only key for background refresh (can fetch the net worth total only).
    static let keyApiKey = "widgetApiKey"
    static let keyApiKeyAt = "widgetApiKeyAt"

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
        defaults.removeObject(forKey: WidgetBridgePlugin.keyApiKey)
        defaults.removeObject(forKey: WidgetBridgePlugin.keyApiKeyAt)

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    /// Background refresh: keep the read-only key in the shared container so the
    /// widget extension can fetch the net worth on its own.
    @objc func setKey(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), key.count >= 20, key.count <= 200 else {
            call.reject("a valid key is required")
            return
        }
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroup) is not available")
            return
        }
        defaults.set(key, forKey: WidgetBridgePlugin.keyApiKey)
        defaults.set(Date().timeIntervalSince1970, forKey: WidgetBridgePlugin.keyApiKeyAt)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    @objc func getKeyInfo(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup)
        let has = defaults?.string(forKey: WidgetBridgePlugin.keyApiKey) != nil
        let at = defaults?.double(forKey: WidgetBridgePlugin.keyApiKeyAt) ?? 0
        let ageDays = (has && at > 0) ? Int((Date().timeIntervalSince1970 - at) / 86400) : 9999
        call.resolve(["hasKey": has, "ageDays": ageDays])
    }

    /// App lock turned on/off: hide or show the balance right away.
    @objc func setHidden(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group \(WidgetBridgePlugin.appGroup) is not available")
            return
        }
        defaults.set(call.getBool("hidden") ?? false, forKey: WidgetBridgePlugin.keyHidden)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}

import AppIntents
import Foundation

// "Hey Siri, what's my net worth in OmniWealth" — answers from the value the
// app last wrote to the shared App Group container (same data as the widget).
// Runs without opening the app. iOS 16+.

private let appGroup = "group.com.omniwealth.app"

@available(iOS 16.0, *)
struct NetWorthIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Net Worth"
    static var description = IntentDescription("Reads your household net worth from OmniWealth.")
    static var openAppWhenRun = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let defaults = UserDefaults(suiteName: appGroup)
        guard let amount = defaults?.object(forKey: "netWorthAmount") as? Double,
              let currency = defaults?.string(forKey: "netWorthCurrency") else {
            return .result(dialog: "Open OmniWealth once so I can read your latest net worth.")
        }
        return .result(dialog: "Your household net worth is \(Self.format(amount, currency: currency)).")
    }

    static func format(_ value: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(Int(value)) \(currency)"
    }
}

@available(iOS 16.0, *)
struct OmniWealthShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NetWorthIntent(),
            phrases: [
                "What's my net worth in \(.applicationName)",
                "Check my net worth with \(.applicationName)",
                "\(.applicationName) net worth"
            ],
            shortTitle: "Net Worth",
            systemImageName: "chart.line.uptrend.xyaxis"
        )
    }
}

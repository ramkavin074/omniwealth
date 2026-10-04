import WidgetKit
import SwiftUI
import AppIntents

// Reads the values written by WidgetBridgePlugin.setNetWorth() in the host app.
private let appGroup = "group.com.omniwealth.app"
// Fixed on purpose: the key is only ever sent to this address.
private let widgetEndpoint = URL(string: "https://www.omniwealth.org/api/widget/net-worth")!

/// Refuses redirects so the key can never be forwarded to another host.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    static let shared = NoRedirects()
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

struct NetWorthEntry: TimelineEntry {
    let date: Date
    let amount: Double?
    let currency: String
    let updatedAt: Date?
    let hidden: Bool
    // True for the ~30 seconds after the user unlocked the widget with a tap.
    let revealed: Bool

    var locked: Bool { hidden && !revealed }
}

struct Provider: TimelineProvider {
    private func read(at date: Date = Date()) -> NetWorthEntry {
        let d = UserDefaults(suiteName: appGroup)
        let amount = d?.object(forKey: "netWorthAmount") as? Double
        let currency = d?.string(forKey: "netWorthCurrency") ?? "USD"
        let ts = d?.object(forKey: "netWorthUpdatedAt") as? Double
        let hidden = d?.bool(forKey: "netWorthHidden") ?? false
        let revealUntil = d?.double(forKey: "netWorthRevealUntil") ?? 0
        return NetWorthEntry(
            date: date,
            amount: amount,
            currency: currency,
            updatedAt: ts.map { Date(timeIntervalSince1970: $0) },
            hidden: hidden,
            revealed: revealUntil > date.timeIntervalSince1970
        )
    }

    func placeholder(in context: Context) -> NetWorthEntry {
        NetWorthEntry(date: Date(), amount: 761_900, currency: "USD", updatedAt: Date(), hidden: false, revealed: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (NetWorthEntry) -> Void) {
        completion(read())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NetWorthEntry>) -> Void) {
        func finish() {
            // iOS decides the real cadence; this asks for a refresh in a few hours.
            let next = Calendar.current.date(byAdding: .hour, value: 3, to: Date()) ?? Date().addingTimeInterval(10_800)
            var entries = [read()]
            // After an unlock, add a second entry that locks the widget again on time.
            let revealUntil = UserDefaults(suiteName: appGroup)?.double(forKey: "netWorthRevealUntil") ?? 0
            if revealUntil > Date().timeIntervalSince1970 {
                let relock = Date(timeIntervalSince1970: revealUntil)
                entries.append(read(at: relock))
            }
            completion(Timeline(entries: entries, policy: .after(next)))
        }

        let d = UserDefaults(suiteName: appGroup)
        // No key (older install / background refresh off): show what the app last stored.
        guard let key = d?.string(forKey: "widgetApiKey") else { finish(); return }

        var request = URLRequest(url: widgetEndpoint)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15

        let session = URLSession(configuration: .ephemeral, delegate: NoRedirects.shared, delegateQueue: nil)
        session.dataTask(with: request) { data, response, _ in
            defer { finish() }
            guard let http = response as? HTTPURLResponse else { return }
            if http.statusCode == 401 {
                // Key revoked or expired (sign-out, password change, "turn off"): forget it all.
                for k in ["widgetApiKey", "widgetApiKeyAt", "netWorthAmount", "netWorthCurrency", "netWorthUpdatedAt", "netWorthHidden"] {
                    d?.removeObject(forKey: k)
                }
                return
            }
            guard http.statusCode == 200, let data,
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let amount = (obj["amount"] as? NSNumber)?.doubleValue,
                  let currency = obj["currency"] as? String else { return }
            d?.set(amount, forKey: "netWorthAmount")
            d?.set(currency, forKey: "netWorthCurrency")
            d?.set(Date().timeIntervalSince1970, forKey: "netWorthUpdatedAt")
        }.resume()
    }
}

private func compact(_ value: Double) -> String {
    let abs = Swift.abs(value)
    let sign = value < 0 ? "-" : ""
    switch abs {
    case 1_000_000_000...:
        return "\(sign)\(String(format: "%.2f", abs / 1_000_000_000))B"
    case 1_000_000...:
        return "\(sign)\(String(format: "%.2f", abs / 1_000_000))M"
    case 1_000...:
        return "\(sign)\(String(format: "%.1f", abs / 1_000))K"
    default:
        return "\(sign)\(String(format: "%.0f", abs))"
    }
}


/// Tapping the locked widget runs this. iOS asks for Face ID / the passcode first
/// (authenticationPolicy), then the number shows for about 30 seconds.
@available(iOS 17.0, *)
struct RevealNetWorthIntent: AppIntent {
    static var title: LocalizedStringResource = "Unlock net worth"
    static var description = IntentDescription("Shows your net worth on the widget for 30 seconds.")
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    func perform() async throws -> some IntentResult {
        UserDefaults(suiteName: appGroup)?.set(Date().timeIntervalSince1970 + 30, forKey: "netWorthRevealUntil")
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct NetWorthWidgetEntryView: View {
    var entry: NetWorthEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("NET WORTH")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(.secondary)

            if entry.locked && entry.amount != nil {
                // Locked: dots until the user taps and confirms Face ID / the passcode.
                if #available(iOS 17.0, *) {
                    Button(intent: RevealNetWorthIntent()) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("••••••")
                                .font(.system(size: 28, weight: .heavy, design: .rounded))
                                .foregroundStyle(Color(red: 0.06, green: 0.5, blue: 0.42))
                            Text("Tap to unlock")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                } else {
                    Text("••••••")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color(red: 0.06, green: 0.5, blue: 0.42))
                    Text("Open the app to see it")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            } else if let amount = entry.amount {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(compact(amount))
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color(red: 0.06, green: 0.5, blue: 0.42))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(entry.currency)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("Open OmniWealth")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
            }

            Spacer(minLength: 0)

            if !entry.locked, let updatedAt = entry.updatedAt {
                Text("Updated \(updatedAt.formatted(.relative(presentation: .named)))")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { Color(.systemBackground) }
        // Tapping the widget opens the app (Universal Link → dashboard).
        .widgetURL(URL(string: "https://www.omniwealth.org/"))
    }
}

struct NetWorthWidget: Widget {
    let kind = "NetWorthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            NetWorthWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Net Worth")
        .description("Your household net worth at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

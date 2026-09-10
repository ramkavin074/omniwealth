import WidgetKit
import SwiftUI

// Reads the values written by WidgetBridgePlugin.setNetWorth() in the host app.
private let appGroup = "group.com.omniwealth.app"

struct NetWorthEntry: TimelineEntry {
    let date: Date
    let amount: Double?
    let currency: String
    let updatedAt: Date?
}

struct Provider: TimelineProvider {
    private func read() -> NetWorthEntry {
        let d = UserDefaults(suiteName: appGroup)
        let amount = d?.object(forKey: "netWorthAmount") as? Double
        let currency = d?.string(forKey: "netWorthCurrency") ?? "USD"
        let ts = d?.object(forKey: "netWorthUpdatedAt") as? Double
        return NetWorthEntry(
            date: Date(),
            amount: amount,
            currency: currency,
            updatedAt: ts.map { Date(timeIntervalSince1970: $0) }
        )
    }

    func placeholder(in context: Context) -> NetWorthEntry {
        NetWorthEntry(date: Date(), amount: 761_900, currency: "USD", updatedAt: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (NetWorthEntry) -> Void) {
        completion(read())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NetWorthEntry>) -> Void) {
        let entry = read()
        // The host app refreshes on demand; this is just a slow safety cadence.
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date()) ?? Date().addingTimeInterval(21_600)
        completion(Timeline(entries: [entry], policy: .after(next)))
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

struct NetWorthWidgetEntryView: View {
    var entry: NetWorthEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("NET WORTH")
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(.secondary)

            if let amount = entry.amount {
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

            if let updatedAt = entry.updatedAt {
                Text("Updated \(updatedAt.formatted(.relative(presentation: .named)))")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { Color(.systemBackground) }
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

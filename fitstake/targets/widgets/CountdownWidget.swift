import WidgetKit
import SwiftUI

struct CountdownEntry: TimelineEntry {
  let date: Date
  let snapshot: FitStakeSnapshot
}

struct CountdownProvider: TimelineProvider {
  func placeholder(in context: Context) -> CountdownEntry {
    CountdownEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
    completion(CountdownEntry(date: Date(), snapshot: SharedStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
    let now = Date()
    let snap = SharedStore.load()
    var entries: [CountdownEntry] = []
    for offset in 0..<6 {
      entries.append(CountdownEntry(
        date: now.addingTimeInterval(Double(offset) * 60 * 5),
        snapshot: snap
      ))
    }
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(60 * 30))))
  }
}

struct CountdownWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: CountdownEntry

  var bet: FitStakeSnapshot.NextBet? { entry.snapshot.nextBet }
  var endsAt: Date {
    if let ms = bet?.endsAt { return Date.fromMillis(ms) }
    return Date().addingTimeInterval(3600)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        Image(systemName: "timer")
          .foregroundStyle(Color.accentAmber)
        Text("Bet ends in")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Spacer()
      }
      Text(timerInterval: Date()...max(endsAt, Date().addingTimeInterval(1)), countsDown: true)
        .font(.system(size: family == .systemSmall ? 24 : 30, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(.primary)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      if let b = bet {
        Text(b.title)
          .font(.caption)
          .foregroundStyle(.primary)
          .lineLimit(2)
        Spacer(minLength: 0)
        HStack(spacing: 6) {
          Text("Stake")
            .font(.caption2)
            .foregroundStyle(.secondary)
          Text(formatStake(b.stakeAmount))
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color.progressFg)
          Spacer()
          Text("\(Int(Double(b.currentProgress) / max(Double(b.stepGoal), 1) * 100))%")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.primary)
        }
      } else {
        Spacer()
        Text("No active bet")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(bet.map { DeepLink.challenge($0.challengeId) } ?? DeepLink.challenges)
  }
}

struct CountdownWidget: Widget {
  let kind: String = "FitStakeCountdownWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: CountdownProvider()) { entry in
      CountdownWidgetView(entry: entry)
    }
    .configurationDisplayName("Bet Countdown")
    .description("How long until your active FitStake bet settles.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

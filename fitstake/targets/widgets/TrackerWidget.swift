import WidgetKit
import SwiftUI

struct TrackerEntry: TimelineEntry {
  let date: Date
  let snapshot: FitStakeSnapshot
}

struct TrackerProvider: TimelineProvider {
  func placeholder(in context: Context) -> TrackerEntry {
    TrackerEntry(date: Date(), snapshot: .placeholder)
  }
  func getSnapshot(in context: Context, completion: @escaping (TrackerEntry) -> Void) {
    completion(TrackerEntry(date: Date(), snapshot: SharedStore.load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<TrackerEntry>) -> Void) {
    completion(Timeline(
      entries: [TrackerEntry(date: Date(), snapshot: SharedStore.load())],
      policy: .after(Date().addingTimeInterval(60 * 15))
    ))
  }
}

struct ProgressRing: View {
  var progress: Double  // 0...1
  var lineWidth: CGFloat = 8
  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.primary.opacity(0.12), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: max(0.001, min(1, progress)))
        .stroke(Color.progressFg,
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
        .animation(.easeInOut(duration: 0.4), value: progress)
    }
  }
}

struct TrackerWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: TrackerEntry

  var pct: Double {
    Double(entry.snapshot.todaySteps) / max(Double(entry.snapshot.stepGoal), 1)
  }

  var body: some View {
    Group {
      if family == .systemSmall {
        smallView
      } else {
        mediumView
      }
    }
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(DeepLink.today)
  }

  private var smallView: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Image(systemName: "figure.walk")
          .foregroundStyle(Color.progressFg)
        Text("Today")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Spacer()
      }
      ZStack {
        ProgressRing(progress: pct)
          .frame(width: 70, height: 70)
        VStack(spacing: 0) {
          Text(formatSteps(entry.snapshot.todaySteps))
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.primary)
          Text("\(Int(pct * 100))%")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .center)
      HStack {
        Image(systemName: "flame.fill")
          .font(.caption2)
          .foregroundStyle(Color.accentAmber)
        Text("\(entry.snapshot.streakDays)d")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.primary)
        Spacer()
        Text(formatStake(entry.snapshot.walletBalance))
          .font(.caption2.weight(.semibold))
          .foregroundStyle(Color.progressFg)
      }
    }
  }

  private var mediumView: some View {
    HStack(spacing: 14) {
      ZStack {
        ProgressRing(progress: pct, lineWidth: 10)
          .frame(width: 84, height: 84)
        VStack(spacing: 0) {
          Text(formatSteps(entry.snapshot.todaySteps))
            .font(.system(size: 20, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.primary)
          Text("\(Int(pct * 100))%")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      VStack(alignment: .leading, spacing: 6) {
        Text("FitStake")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
        Link(destination: DeepLink.today) {
          statRow(icon: "target", label: "Goal", value: formatSteps(entry.snapshot.stepGoal))
        }
        Link(destination: DeepLink.today) {
          statRow(icon: "flame.fill", label: "Streak", value: "\(entry.snapshot.streakDays)d", tint: Color.accentAmber)
        }
        Link(destination: DeepLink.wallet) {
          statRow(icon: "dollarsign.circle.fill", label: "Wallet", value: formatStake(entry.snapshot.walletBalance), tint: Color.progressFg)
        }
        Link(destination: DeepLink.challenges) {
          statRow(icon: "bolt.fill", label: "Bets", value: "\(entry.snapshot.activeBetCount)", tint: Color.accentAmber)
        }
      }
      Spacer(minLength: 0)
    }
  }

  private func statRow(icon: String, label: String, value: String, tint: Color = .secondary) -> some View {
    HStack(spacing: 6) {
      Image(systemName: icon)
        .font(.caption2)
        .foregroundStyle(tint)
        .frame(width: 14)
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)
      Spacer()
      Text(value)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.primary)
        .monospacedDigit()
    }
  }
}

struct TrackerWidget: Widget {
  let kind: String = "FitStakeTrackerWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TrackerProvider()) { entry in
      TrackerWidgetView(entry: entry)
    }
    .configurationDisplayName("Daily Tracker")
    .description("Steps progress, streak, wallet, and active bets.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

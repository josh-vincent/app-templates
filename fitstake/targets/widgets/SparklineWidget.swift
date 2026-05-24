import WidgetKit
import SwiftUI

struct SparklineEntry: TimelineEntry {
  let date: Date
  let snapshot: FitStakeSnapshot
}

struct SparklineProvider: TimelineProvider {
  func placeholder(in context: Context) -> SparklineEntry {
    SparklineEntry(date: Date(), snapshot: .placeholder)
  }
  func getSnapshot(in context: Context, completion: @escaping (SparklineEntry) -> Void) {
    completion(SparklineEntry(date: Date(), snapshot: SharedStore.load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SparklineEntry>) -> Void) {
    let snap = SharedStore.load()
    let entry = SparklineEntry(date: Date(), snapshot: snap)
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 30))))
  }
}

/// Lightweight inline sparkline. Avoids Charts so it runs on iOS 15+.
struct Sparkline: View {
  let values: [Int]
  let goal: Int
  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let h = geo.size.height
      let maxV = max(values.max() ?? 1, goal, 1)
      let minV = 0
      let step = values.count > 1 ? w / CGFloat(values.count - 1) : w
      Path { p in
        for (i, v) in values.enumerated() {
          let x = CGFloat(i) * step
          let y = h - (CGFloat(v - minV) / CGFloat(maxV - minV)) * h
          if i == 0 { p.move(to: CGPoint(x: x, y: y)) }
          else { p.addLine(to: CGPoint(x: x, y: y)) }
        }
      }
      .stroke(Color.progressFg, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

      Path { p in
        for (i, v) in values.enumerated() {
          let x = CGFloat(i) * step
          let y = h - (CGFloat(v - minV) / CGFloat(maxV - minV)) * h
          if i == 0 { p.move(to: CGPoint(x: x, y: h)) }
          p.addLine(to: CGPoint(x: x, y: y))
          if i == values.count - 1 {
            p.addLine(to: CGPoint(x: x, y: h))
            p.closeSubpath()
          }
        }
      }
      .fill(LinearGradient(
        colors: [Color.progressFg.opacity(0.35), Color.progressFg.opacity(0.0)],
        startPoint: .top, endPoint: .bottom
      ))

      // Goal line
      Path { p in
        let y = h - (CGFloat(goal) / CGFloat(maxV)) * h
        p.move(to: CGPoint(x: 0, y: y))
        p.addLine(to: CGPoint(x: w, y: y))
      }
      .stroke(Color.accentAmber.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
    }
  }
}

struct SparklineWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: SparklineEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Image(systemName: "chart.line.uptrend.xyaxis")
          .foregroundStyle(Color.progressFg)
        Text("Steps · 7d")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Spacer()
        Text(formatSteps(entry.snapshot.todaySteps))
          .font(.system(size: 16, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(.primary)
      }
      Sparkline(values: entry.snapshot.sparkline7d.isEmpty ? [0, 0, 0, 0, 0, 0, 0] : entry.snapshot.sparkline7d,
                goal: entry.snapshot.stepGoal)
      .padding(.vertical, 2)
      HStack {
        Text("Goal \(formatSteps(entry.snapshot.stepGoal))")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Spacer()
        let pct = Int(Double(entry.snapshot.todaySteps) / max(Double(entry.snapshot.stepGoal), 1) * 100)
        Text("\(pct)%")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(pct >= 100 ? Color.progressFg : .primary)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
    .widgetURL(DeepLink.today)
  }
}

struct SparklineWidget: Widget {
  let kind: String = "FitStakeSparklineWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SparklineProvider()) { entry in
      SparklineWidgetView(entry: entry)
    }
    .configurationDisplayName("Steps Sparkline")
    .description("Your last 7 days of steps with goal line.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

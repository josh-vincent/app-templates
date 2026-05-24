import SwiftUI

@main
struct FitStakeWatchApp: App {
  var body: some Scene {
    WindowGroup {
      WatchRootView()
    }
  }
}

struct WatchRootView: View {
  @State private var snapshot: FitStakeSnapshot = SharedStore.load()
  @State private var tab: Int = 0

  var body: some View {
    TabView(selection: $tab) {
      TrackerScene(snapshot: snapshot).tag(0)
      CountdownScene(snapshot: snapshot).tag(1)
      SparklineScene(snapshot: snapshot).tag(2)
    }
    .tabViewStyle(.page)
    .onAppear { snapshot = SharedStore.load() }
  }
}

struct TrackerScene: View {
  let snapshot: FitStakeSnapshot
  var pct: Double {
    Double(snapshot.todaySteps) / max(Double(snapshot.stepGoal), 1)
  }
  var body: some View {
    VStack(spacing: 8) {
      ZStack {
        Circle()
          .stroke(Color.progressBg, lineWidth: 8)
        Circle()
          .trim(from: 0, to: max(0.001, min(1, pct)))
          .stroke(Color.progressFg, style: StrokeStyle(lineWidth: 8, lineCap: .round))
          .rotationEffect(.degrees(-90))
        VStack(spacing: 0) {
          Text(formatSteps(snapshot.todaySteps))
            .font(.system(size: 22, weight: .bold, design: .rounded))
            .monospacedDigit()
          Text("\(Int(pct * 100))%")
            .font(.caption2)
            .foregroundStyle(Color.cardFg.opacity(0.7))
        }
      }
      .frame(width: 110, height: 110)
      HStack(spacing: 10) {
        Label("\(snapshot.streakDays)d", systemImage: "flame.fill")
          .foregroundStyle(Color.accentAmber)
          .font(.caption2.weight(.semibold))
        Label(formatStake(snapshot.walletBalance), systemImage: "dollarsign.circle.fill")
          .foregroundStyle(Color.progressFg)
          .font(.caption2.weight(.semibold))
      }
    }
    .padding(.vertical, 6)
  }
}

struct CountdownScene: View {
  let snapshot: FitStakeSnapshot
  var endsAt: Date {
    if let ms = snapshot.nextBet?.endsAt { return Date(timeIntervalSince1970: ms / 1000) }
    return Date().addingTimeInterval(3600)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Image(systemName: "timer").foregroundStyle(Color.accentAmber)
        Text("Bet ends in").font(.caption).foregroundStyle(Color.cardFg.opacity(0.7))
      }
      Text(timerInterval: Date()...max(endsAt, Date().addingTimeInterval(1)), countsDown: true)
        .font(.system(size: 26, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      if let b = snapshot.nextBet {
        Text(b.title)
          .font(.caption)
          .foregroundStyle(Color.cardFg.opacity(0.85))
          .lineLimit(2)
        HStack {
          Text("Stake").font(.caption2).foregroundStyle(Color.cardFg.opacity(0.6))
          Spacer()
          Text(formatStake(b.stakeAmount)).font(.caption.weight(.semibold)).foregroundStyle(Color.progressFg)
        }
      } else {
        Text("No active bet").font(.caption).foregroundStyle(Color.cardFg.opacity(0.5))
      }
    }
    .padding(.horizontal, 4)
  }
}

struct SparklineScene: View {
  let snapshot: FitStakeSnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(Color.progressFg)
        Text("Steps · 7d").font(.caption).foregroundStyle(Color.cardFg.opacity(0.7))
        Spacer()
        Text(formatSteps(snapshot.todaySteps))
          .font(.headline).monospacedDigit()
      }
      WatchSparkline(values: snapshot.sparkline7d, goal: snapshot.stepGoal)
        .frame(height: 70)
      HStack {
        Text("Goal \(formatSteps(snapshot.stepGoal))")
          .font(.caption2).foregroundStyle(Color.cardFg.opacity(0.55))
        Spacer()
        let pct = Int(Double(snapshot.todaySteps) / max(Double(snapshot.stepGoal), 1) * 100)
        Text("\(pct)%").font(.caption2.weight(.semibold))
          .foregroundStyle(pct >= 100 ? Color.progressFg : Color.cardFg.opacity(0.8))
      }
    }
    .padding(.horizontal, 4)
  }
}

struct WatchSparkline: View {
  let values: [Int]
  let goal: Int
  var body: some View {
    GeometryReader { geo in
      let w = geo.size.width
      let h = geo.size.height
      let maxV = max(values.max() ?? 1, goal, 1)
      let step = values.count > 1 ? w / CGFloat(values.count - 1) : w
      Path { p in
        for (i, v) in values.enumerated() {
          let x = CGFloat(i) * step
          let y = h - (CGFloat(v) / CGFloat(maxV)) * h
          if i == 0 { p.move(to: CGPoint(x: x, y: y)) }
          else { p.addLine(to: CGPoint(x: x, y: y)) }
        }
      }
      .stroke(Color.progressFg, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

      Path { p in
        let y = h - (CGFloat(goal) / CGFloat(maxV)) * h
        p.move(to: CGPoint(x: 0, y: y))
        p.addLine(to: CGPoint(x: w, y: y))
      }
      .stroke(Color.accentAmber.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
    }
  }
}

extension Color {
  static let cardBg = Color("cardBg")
  static let cardFg = Color("cardFg")
  static let progressFg = Color("progressFg")
  static let progressBg = Color("progressBg")
  static let accentAmber = Color("accentAmber")
}

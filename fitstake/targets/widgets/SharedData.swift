import Foundation
import SwiftUI

/// Snapshot mirroring what the JS layer pushes via WidgetBridge.setSnapshot().
struct FitStakeSnapshot: Codable {
  struct NextBet: Codable {
    var challengeId: String
    var title: String
    var stakeAmount: Double
    var endsAt: TimeInterval        // epoch ms
    var stepGoal: Int
    var currentProgress: Int
  }
  var updatedAt: TimeInterval       // epoch ms
  var todaySteps: Int
  var stepGoal: Int
  var walletBalance: Double
  var streakDays: Int
  var sparkline7d: [Int]
  var nextBet: NextBet?
  var activeBetCount: Int

  static let placeholder = FitStakeSnapshot(
    updatedAt: Date().timeIntervalSince1970 * 1000,
    todaySteps: 7842,
    stepGoal: 10000,
    walletBalance: 320,
    streakDays: 5,
    sparkline7d: [4200, 8800, 9500, 12000, 6700, 9100, 7842],
    nextBet: NextBet(
      challengeId: "placeholder",
      title: "10k steps for 7 days",
      stakeAmount: 50,
      endsAt: (Date().timeIntervalSince1970 + 3 * 3600) * 1000,
      stepGoal: 10000,
      currentProgress: 7842
    ),
    activeBetCount: 2
  )
}

enum SharedStore {
  static let suiteName = "group.com.tocld.fitstake"
  static let snapshotKey = "fitstake.snapshot.v1"

  static func load() -> FitStakeSnapshot {
    guard
      let defaults = UserDefaults(suiteName: suiteName),
      let json = defaults.string(forKey: snapshotKey),
      let data = json.data(using: .utf8)
    else {
      return .placeholder
    }
    let dec = JSONDecoder()
    if let snap = try? dec.decode(FitStakeSnapshot.self, from: data) {
      return snap
    }
    return .placeholder
  }
}

extension Date {
  static func fromMillis(_ ms: TimeInterval) -> Date {
    Date(timeIntervalSince1970: ms / 1000.0)
  }
}

/// Deep-link URLs routed by expo-router via the `fitstake://` scheme.
/// Matches routes under app/(tabs)/.
enum DeepLink {
  static let scheme = "fitstake"
  static let today = URL(string: "\(scheme):///")!
  static let challenges = URL(string: "\(scheme):///challenges")!
  static let wallet = URL(string: "\(scheme):///wallet")!
  static let jackpot = URL(string: "\(scheme):///jackpot")!
  static let profile = URL(string: "\(scheme):///profile")!

  static func challenge(_ id: String) -> URL {
    URL(string: "\(scheme):///challenges/\(id)")!
  }
}

extension Color {
  static let cardBg = Color("cardBg")
  static let cardFg = Color("cardFg")
  static let progressFg = Color("progressFg")
  static let progressBg = Color("progressBg")
  static let accentAmber = Color("accentAmber")
}

/// Compact currency formatter for stake amounts.
func formatStake(_ amount: Double) -> String {
  if amount >= 1000 {
    return String(format: "$%.1fk", amount / 1000)
  }
  return String(format: "$%.0f", amount)
}

func formatSteps(_ n: Int) -> String {
  if n >= 1000 {
    let k = Double(n) / 1000.0
    return String(format: "%.1fk", k)
  }
  return "\(n)"
}

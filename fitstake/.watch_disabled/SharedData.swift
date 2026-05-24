import Foundation
import SwiftUI

/// Watch-side copy of the snapshot. Mirrors the iOS widget extension's
/// `FitStakeSnapshot`. The watch reads the shared App Group on every
/// activation; the phone is responsible for writing fresh values.
struct FitStakeSnapshot: Codable {
  struct NextBet: Codable {
    var title: String
    var stakeAmount: Double
    var endsAt: TimeInterval
    var stepGoal: Int
    var currentProgress: Int
  }
  var updatedAt: TimeInterval
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
      let data = json.data(using: .utf8),
      let snap = try? JSONDecoder().decode(FitStakeSnapshot.self, from: data)
    else {
      return .placeholder
    }
    return snap
  }
}

func formatStake(_ amount: Double) -> String {
  if amount >= 1000 { return String(format: "$%.1fk", amount / 1000) }
  return String(format: "$%.0f", amount)
}

func formatSteps(_ n: Int) -> String {
  if n >= 1000 { return String(format: "%.1fk", Double(n) / 1000.0) }
  return "\(n)"
}

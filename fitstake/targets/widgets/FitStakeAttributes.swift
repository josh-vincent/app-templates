import Foundation
import ActivityKit

@available(iOS 16.2, *)
public struct FitStakeBetAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var currentSteps: Int
    public var lastUpdatedAt: Date

    public init(currentSteps: Int, lastUpdatedAt: Date) {
      self.currentSteps = currentSteps
      self.lastUpdatedAt = lastUpdatedAt
    }
  }
  public var betId: String
  public var title: String
  public var stakeAmount: Double
  public var stepGoal: Int
  public var endsAt: Date

  public init(betId: String, title: String, stakeAmount: Double, stepGoal: Int, endsAt: Date) {
    self.betId = betId
    self.title = title
    self.stakeAmount = stakeAmount
    self.stepGoal = stepGoal
    self.endsAt = endsAt
  }
}

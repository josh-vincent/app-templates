import Foundation
import React
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

@available(iOS 16.2, *)
public struct FitStakeBetAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var currentSteps: Int
    public var lastUpdatedAt: Date
  }
  public var betId: String
  public var title: String
  public var stakeAmount: Double
  public var stepGoal: Int
  public var endsAt: Date
}

@objc(WidgetBridge)
final class WidgetBridge: NSObject {
  private static let suiteName = "group.com.tocld.fitstake"
  private static let snapshotKey = "fitstake.snapshot.v1"

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc
  func setSnapshot(_ json: NSString,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = UserDefaults(suiteName: WidgetBridge.suiteName) else {
      reject("E_GROUP", "App group \(WidgetBridge.suiteName) is not available", nil)
      return
    }
    defaults.set(json as String, forKey: WidgetBridge.snapshotKey)
    defaults.synchronize()
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
    resolve(true)
  }

  @objc
  func readSnapshot(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    let defaults = UserDefaults(suiteName: WidgetBridge.suiteName)
    resolve(defaults?.string(forKey: WidgetBridge.snapshotKey) ?? "")
  }

  @objc
  func reloadAllTimelines(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
    resolve(true)
  }

  @objc
  func startLiveActivity(_ attrs: NSDictionary,
                         state: NSDictionary,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(ActivityKit)
    if #available(iOS 16.2, *) {
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        reject("E_LA_DISABLED", "Live Activities are disabled on this device", nil)
        return
      }
      let attributes = FitStakeBetAttributes(
        betId: (attrs["betId"] as? String) ?? UUID().uuidString,
        title: (attrs["title"] as? String) ?? "FitStake",
        stakeAmount: (attrs["stakeAmount"] as? Double) ?? 0,
        stepGoal: (attrs["stepGoal"] as? Int) ?? 10000,
        endsAt: Date(timeIntervalSince1970: ((attrs["endsAt"] as? Double) ?? Date().timeIntervalSince1970 * 1000) / 1000.0)
      )
      let initial = FitStakeBetAttributes.ContentState(
        currentSteps: (state["currentSteps"] as? Int) ?? 0,
        lastUpdatedAt: Date()
      )
      do {
        let content = ActivityContent(state: initial, staleDate: Date().addingTimeInterval(60 * 60 * 12))
        let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
        resolve(activity.id)
      } catch {
        reject("E_LA_START", error.localizedDescription, error)
      }
      return
    }
    #endif
    reject("E_LA_UNAVAILABLE", "Live Activities require iOS 16.2+", nil)
  }

  @objc
  func updateLiveActivity(_ activityId: NSString,
                          state: NSDictionary,
                          resolver resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(ActivityKit)
    if #available(iOS 16.2, *) {
      let id = activityId as String
      Task {
        if let activity = Activity<FitStakeBetAttributes>.activities.first(where: { $0.id == id }) {
          let updated = FitStakeBetAttributes.ContentState(
            currentSteps: (state["currentSteps"] as? Int) ?? activity.content.state.currentSteps,
            lastUpdatedAt: Date()
          )
          let content = ActivityContent(state: updated, staleDate: Date().addingTimeInterval(60 * 60 * 12))
          await activity.update(content)
          resolve(true)
        } else {
          reject("E_LA_NOT_FOUND", "No live activity with id \(id)", nil)
        }
      }
      return
    }
    #endif
    reject("E_LA_UNAVAILABLE", "Live Activities require iOS 16.2+", nil)
  }

  @objc
  func endLiveActivity(_ activityId: NSString,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(ActivityKit)
    if #available(iOS 16.2, *) {
      let id = activityId as String
      Task {
        if let activity = Activity<FitStakeBetAttributes>.activities.first(where: { $0.id == id }) {
          await activity.end(activity.content, dismissalPolicy: .immediate)
          resolve(true)
        } else {
          resolve(false)
        }
      }
      return
    }
    #endif
    reject("E_LA_UNAVAILABLE", "Live Activities require iOS 16.2+", nil)
  }

  @objc
  func listLiveActivities(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(ActivityKit)
    if #available(iOS 16.2, *) {
      let ids = Activity<FitStakeBetAttributes>.activities.map { $0.id }
      resolve(ids)
      return
    }
    #endif
    resolve([])
  }
}

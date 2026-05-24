import WidgetKit
import SwiftUI
import ActivityKit

@available(iOS 16.2, *)
struct FitStakeLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FitStakeBetAttributes.self) { context in
      lockScreenView(context: context)
        .activityBackgroundTint(Color.cardBg)
        .activitySystemActionForegroundColor(Color.cardFg)
        .widgetURL(DeepLink.challenge(context.attributes.betId))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Label(formatStake(context.attributes.stakeAmount), systemImage: "dollarsign.circle.fill")
              .font(.caption.weight(.semibold))
              .foregroundStyle(Color.progressFg)
            Text(context.attributes.title)
              .font(.caption2)
              .foregroundStyle(Color.cardFg.opacity(0.75))
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text(timerInterval: Date()...max(context.attributes.endsAt, Date().addingTimeInterval(1)),
                 countsDown: true)
              .font(.caption.weight(.bold))
              .monospacedDigit()
              .foregroundStyle(Color.accentAmber)
              .frame(maxWidth: 70)
            Text("\(Int(progress(context: context) * 100))%")
              .font(.caption2)
              .foregroundStyle(Color.cardFg.opacity(0.7))
          }
        }
        DynamicIslandExpandedRegion(.center) { EmptyView() }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(value: progress(context: context))
            .tint(Color.progressFg)
        }
      } compactLeading: {
        Image(systemName: "figure.walk")
          .foregroundStyle(Color.progressFg)
      } compactTrailing: {
        Text(timerInterval: Date()...max(context.attributes.endsAt, Date().addingTimeInterval(1)),
             countsDown: true)
          .monospacedDigit()
          .frame(maxWidth: 50)
          .foregroundStyle(Color.accentAmber)
      } minimal: {
        Image(systemName: "figure.walk")
          .foregroundStyle(Color.progressFg)
      }
      .keylineTint(Color.progressFg)
    }
  }

  @ViewBuilder
  private func lockScreenView(context: ActivityViewContext<FitStakeBetAttributes>) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Label("FitStake", systemImage: "figure.walk")
          .font(.caption.weight(.semibold))
          .foregroundStyle(Color.progressFg)
        Spacer()
        Text(timerInterval: Date()...max(context.attributes.endsAt, Date().addingTimeInterval(1)),
             countsDown: true)
          .font(.caption.weight(.bold))
          .monospacedDigit()
          .foregroundStyle(Color.accentAmber)
      }
      Text(context.attributes.title)
        .font(.headline)
        .foregroundStyle(Color.cardFg)
        .lineLimit(2)
      VStack(spacing: 4) {
        HStack {
          Text("\(context.state.currentSteps) / \(context.attributes.stepGoal) steps")
            .font(.caption)
            .foregroundStyle(Color.cardFg.opacity(0.75))
            .monospacedDigit()
          Spacer()
          Text("\(Int(progress(context: context) * 100))%")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color.cardFg)
        }
        ProgressView(value: progress(context: context))
          .tint(Color.progressFg)
      }
      HStack {
        Label(formatStake(context.attributes.stakeAmount), systemImage: "dollarsign.circle.fill")
          .font(.caption2)
          .foregroundStyle(Color.progressFg)
        Spacer()
        Text("Updated \(context.state.lastUpdatedAt, style: .relative) ago")
          .font(.caption2)
          .foregroundStyle(Color.cardFg.opacity(0.4))
      }
    }
    .padding(14)
  }

  private func progress(context: ActivityViewContext<FitStakeBetAttributes>) -> Double {
    let p = Double(context.state.currentSteps) / max(Double(context.attributes.stepGoal), 1)
    return min(max(p, 0), 1)
  }
}

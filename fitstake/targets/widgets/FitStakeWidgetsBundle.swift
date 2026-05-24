import WidgetKit
import SwiftUI

@main
struct FitStakeWidgetsBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    CountdownWidget()
    SparklineWidget()
    TrackerWidget()
    if #available(iOS 16.2, *) {
      FitStakeLiveActivity()
    }
  }
}

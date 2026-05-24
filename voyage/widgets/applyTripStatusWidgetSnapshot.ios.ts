import TripStatusWidget from './TripStatusWidget';
import type { TripStatusWidgetProps } from './tripStatusWidgetSnapshot';

export function applyTripStatusWidgetSnapshot(snapshot: TripStatusWidgetProps) {
  TripStatusWidget.updateSnapshot(snapshot);
}

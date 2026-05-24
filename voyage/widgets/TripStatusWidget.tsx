import { Text, VStack } from '@expo/ui/swift-ui';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

type TripStatusWidgetProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: string;
};

const TripStatusWidgetView = (props: TripStatusWidgetProps, environment: WidgetEnvironment) => {
  'widget';

  const primary = environment.colorScheme === 'dark' ? '#FFFFFF' : '#111827';
  const secondary = environment.colorScheme === 'dark' ? '#CBD5E1' : '#475569';

  return (
    <VStack>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>{props.eyebrow}</Text>
      <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(primary)]}>
        {props.title}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(secondary)]}>{props.subtitle}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>{props.footer}</Text>
    </VStack>
  );
};

export default createWidget<TripStatusWidgetProps>('TripStatusWidget', TripStatusWidgetView);

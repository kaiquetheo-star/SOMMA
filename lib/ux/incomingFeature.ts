import { Alert } from 'react-native';

/** Placeholder feedback for UI actions not yet implemented */
export function alertIncomingFeature(detail?: string): void {
  Alert.alert(
    'Incoming',
    detail ?? 'This feature is being forged.',
    [{ text: 'Understood', style: 'default' }],
  );
}

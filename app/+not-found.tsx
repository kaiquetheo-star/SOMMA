import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center bg-obsidian px-8">
        <Text className="font-display text-xl text-[#E8E4DC]">This ritual path does not exist.</Text>
        <Link href="/" className="mt-6 active:opacity-80">
          <Text className="font-body-medium text-sm uppercase tracking-[0.3em] text-matte-gold">
            Return to Sanctuary →
          </Text>
        </Link>
      </View>
    </>
  );
}

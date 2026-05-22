import { View } from 'react-native';

interface FoundationProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function FoundationProgress({ currentStep, totalSteps }: FoundationProgressProps) {
  return (
    <View className="flex-row gap-2">
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          className={`h-0.5 flex-1 rounded-full ${
            index <= currentStep ? 'bg-matte-gold/80' : 'bg-white/10'
          }`}
        />
      ))}
    </View>
  );
}

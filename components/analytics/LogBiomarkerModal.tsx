import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { BiomarkerPlaceholder } from '@/constants/biomarkers';

interface LogBiomarkerModalProps {
  visible: boolean;
  marker: BiomarkerPlaceholder | null;
  currentValue?: number | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (value: number) => Promise<void>;
}

export function LogBiomarkerModal({
  visible,
  marker,
  currentValue,
  saving,
  onClose,
  onSave,
}: LogBiomarkerModalProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!visible || !marker) return;
    setText(currentValue != null ? String(currentValue) : '');
  }, [visible, marker, currentValue]);

  if (!marker) return null;

  const handleSave = async () => {
    const value = Number.parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return;
    await onSave(value);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl border border-white/10 bg-[#0F1512] px-6 pb-10 pt-6"
        >
          <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B7568]">
            Log marker
          </Text>
          <Text className="mt-2 font-display text-2xl text-[#E8E4DC]">{marker.name}</Text>
          <Text className="mt-1 font-body text-xs text-[#8A9488]">{marker.optimalHint}</Text>

          <View className="mt-6 flex-row items-end gap-3">
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#4A5D44"
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-4 font-display-bold text-3xl text-matte-gold"
              accessibilityLabel={`${marker.name} value`}
            />
            <Text className="pb-4 font-body text-lg text-[#8A9488]">{marker.unit}</Text>
          </View>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onClose}
              disabled={saving}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-4 active:opacity-80"
            >
              <Text className="text-center font-body-medium text-xs uppercase tracking-[0.25em] text-[#8A9488]">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={saving}
              className="flex-[2] rounded-2xl border border-matte-gold/40 bg-matte-gold/10 py-4 active:opacity-80"
            >
              {saving ? (
                <ActivityIndicator color="#BFA06A" />
              ) : (
                <Text className="text-center font-body-medium text-xs uppercase tracking-[0.3em] text-matte-gold">
                  Save reading
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

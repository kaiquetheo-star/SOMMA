import { Pressable, Text, View } from 'react-native';

interface DamageControlToggleProps {
  date: string;
  active: boolean;
  onToggle: () => void;
}

const SAGE = '#6B8E78';

export function DamageControlToggle({ date, active, onToggle }: DamageControlToggleProps) {
  return (
    <View
      className="rounded-3xl border bg-white/[0.03] p-5"
      style={{ borderColor: active ? SAGE : `${SAGE}55` }}
    >
      <Text className="font-body text-[10px] uppercase tracking-[0.35em] text-[#6B8E78]">
        Recuperação Metabólica
      </Text>
      <Text className="mt-3 font-display text-2xl leading-8 text-[#E8E4DC]">
        Damage Control Protocol
      </Text>
      <Text className="mt-3 font-body text-sm leading-6 text-[#8A9488]">
        Ative este protocolo se houve consumo excessivo de álcool ou açúcar nas últimas
        24h. O SOMMA ajustará seus macros e prescreverá um flush metabólico sem julgar.
      </Text>

      <View className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
        <Text className="font-body text-xs leading-5 text-[#B7C7B0]">
          Data alvo · {date}
        </Text>
        <Text className="mt-2 font-body text-xs leading-5 text-[#8A9488]">
          {active
            ? 'Protocolo ativado. Proteína mantida, carboidratos e gorduras otimizados, hidratação ampliada.'
            : 'Proteína será preservada; carboidratos e gorduras serão reduzidos em 40%, com +1000ml de água.'}
        </Text>
      </View>

      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${active ? 'Desativar' : 'Ativar'} protocolo de recuperação metabólica`}
        className="mt-5 rounded-2xl border px-5 py-4 active:opacity-80"
        style={{
          borderColor: SAGE,
          backgroundColor: active ? `${SAGE}26` : 'rgba(255,255,255,0.04)',
        }}
      >
        <Text className="text-center font-body-medium text-xs uppercase tracking-[0.28em] text-[#B7C7B0]">
          {active ? 'Protocolo ativo' : 'Ativar recuperação'}
        </Text>
      </Pressable>
    </View>
  );
}

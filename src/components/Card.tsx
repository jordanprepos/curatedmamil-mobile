import { Pressable, View, type ViewStyle } from 'react-native';
import { cardShadow, colors, radius } from '../theme/tokens';

/** The white rounded surface used across Dasbor, Pesanan and Ringkasan. */
export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const base: ViewStyle = {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  };

  if (!onPress) {
    return <View style={[base, cardShadow, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        base,
        cardShadow,
        pressed ? { backgroundColor: colors.bgApp } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

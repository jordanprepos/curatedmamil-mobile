import { Pressable, type ViewStyle } from 'react-native';
import { Txt } from '../theme/text';
import { cardShadow, colors, radius } from '../theme/tokens';

/**
 * Selectable pill used for the Dasbor filter tabs and the Tambah
 * category/status choosers. Selected = filled primary, per the mockup.
 */
export function Chip({
  label,
  selected,
  onPress,
  flex,
  size = 12.5,
  paddingVertical = 9,
  paddingHorizontal = 16,
  shadow,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  flex?: boolean;
  size?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  shadow?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical,
          paddingHorizontal,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : pressed
              ? colors.chip
              : colors.surface,
          ...(flex ? { flex: 1 } : null),
        },
        shadow ? cardShadow : null,
        style,
      ]}
    >
      <Txt
        size={size}
        weight={500}
        color={selected ? colors.onPrimary : colors.subtle}
        numberOfLines={1}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

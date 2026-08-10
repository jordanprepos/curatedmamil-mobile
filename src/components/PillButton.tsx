import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { Txt } from '../theme/text';
import { cardShadow, colors, radius } from '../theme/tokens';

type Variant = 'primary' | 'outline' | 'plain';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /** Fills the row; the mockup uses this for the full-width action buttons. */
  block?: boolean;
  size?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** `plain` chips in the mockup carry the same soft card shadow. */
  shadow?: boolean;
};

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  block,
  size = 13,
  paddingVertical = 15,
  paddingHorizontal = 16,
  loading,
  disabled,
  style,
  shadow,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          paddingVertical,
          paddingHorizontal,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          ...(block ? { width: '100%' } : { alignSelf: 'flex-start' }),
          ...(variant === 'primary'
            ? {
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              }
            : null),
          ...(variant === 'outline'
            ? {
                backgroundColor: pressed ? colors.chip : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }
            : null),
          ...(variant === 'plain'
            ? { backgroundColor: pressed ? colors.chip : colors.surface }
            : null),
          opacity: isDisabled ? 0.55 : 1,
        },
        shadow ? cardShadow : null,
        style,
      ]}
    >
      {loading ? (
        <View style={{ height: size * 1.2, justifyContent: 'center' }}>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.onPrimary : colors.primary}
          />
        </View>
      ) : (
        <Txt
          size={size}
          weight={500}
          color={variant === 'primary' ? colors.onPrimary : colors.subtle}
          numberOfLines={1}
        >
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

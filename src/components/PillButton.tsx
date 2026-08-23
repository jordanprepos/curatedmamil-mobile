import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { Txt } from '../theme/text';
import { cardShadow, colors, radius } from '../theme/tokens';

type Variant = 'primary' | 'outline' | 'plain' | 'danger';

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
  /**
   * Recolours the button without adding a variant for it.
   *
   * Exists for Pesanan's cancel affordance, whose soft red (`cancelColors`) is
   * neither the mauve of `outline` nor the harder `colors.danger` of `Hapus
   * Produk`. It covers both the tertiary outline and the solid confirm button.
   *
   * Deliberately a prop rather than something passed through `style`: `style`
   * lands after the variant's own rules, so a background set there also wins
   * over the *pressed* background and the button goes dead to the touch. These
   * are applied inside the pressed-aware block instead, so press feedback
   * survives — set `pressedBg` alongside `bg` or the fill won't move on touch.
   */
  tone?: {
    bg?: string;
    pressedBg?: string;
    border?: string;
    label?: string;
  };
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
  tone,
}: Props) {
  const isDisabled = disabled || loading;

  // `primary` reverses out on the filled pill; `danger` carries the warning in
  // the label, since an outline alone doesn't say "this is destructive".
  const labelColor =
    tone?.label ??
    (variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : colors.subtle);

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
          ...(variant === 'danger'
            ? {
                backgroundColor: pressed ? colors.chip : colors.surface,
                borderWidth: 1,
                borderColor: colors.danger,
              }
            : null),
          // After the variant blocks, so a `tone` overrides them — but still
          // inside the pressed-aware function, unlike `style`.
          ...(tone?.bg
            ? { backgroundColor: pressed ? (tone.pressedBg ?? tone.bg) : tone.bg }
            : null),
          ...(tone?.border ? { borderWidth: 1, borderColor: tone.border } : null),
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
            // Not `labelColor`: outline/plain spinners are mauve, not their
            // muted label grey. Only `danger` follows its label.
            color={
              tone?.label ??
              (variant === 'primary'
                ? colors.onPrimary
                : variant === 'danger'
                  ? colors.danger
                  : colors.primary)
            }
          />
        </View>
      ) : (
        <Txt size={size} weight={500} color={labelColor} numberOfLines={1}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

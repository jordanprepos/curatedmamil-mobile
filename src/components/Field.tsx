import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Label } from '../theme/text';
import { cardShadow, colors, radius } from '../theme/tokens';

/**
 * A labelled input as used on the Tambah screen: small all-caps label above a
 * white, borderless, softly-shadowed field.
 */
export function Field({
  label,
  containerStyle,
  style,
  ...rest
}: TextInputProps & { label?: string; containerStyle?: ViewStyle }) {
  return (
    <View style={containerStyle}>
      {label ? <Label style={{ marginBottom: 7 }}>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[
          {
            width: '100%',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: radius.input,
            backgroundColor: colors.surface,
            fontFamily: 'Jost_300Light',
            fontSize: 14,
            color: colors.ink,
          },
          cardShadow,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

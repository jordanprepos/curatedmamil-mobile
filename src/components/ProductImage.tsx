import { Image, View, type ViewStyle } from 'react-native';
import { Txt } from '../theme/text';
import { colors } from '../theme/tokens';
import { initials } from '../lib/format';

/**
 * Stands in for the mockup's <image-slot>. That component was a drag-and-drop
 * placeholder tied to the Claude Design runtime; here a product either has an
 * uploaded photo or falls back to a monogram on the warm neutral chip colour.
 */
export function ProductImage({
  uri,
  name,
  radius: r,
  monogramSize = 16,
  style,
}: {
  uri?: string;
  name: string;
  radius: number;
  monogramSize?: number;
  style?: ViewStyle;
}) {
  const box: ViewStyle = {
    width: '100%',
    height: '100%',
    borderRadius: r,
    overflow: 'hidden',
    backgroundColor: colors.chip,
  };

  if (uri) {
    return (
      <View style={[box, style]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityLabel={name}
        />
      </View>
    );
  }

  return (
    <View style={[box, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <Txt size={monogramSize} weight={500} color={colors.faint} tracking={0.08}>
        {initials(name)}
      </Txt>
    </View>
  );
}

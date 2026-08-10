import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors } from './tokens';

/**
 * React Native `Text` does not inherit fontFamily from ancestors, so every
 * piece of copy has to name its face. These wrappers keep that in one place —
 * use <Txt> for UI (Jost) and <Display> for the serif accents (Playfair),
 * matching the mockup's two-font system.
 */

/** Jost weights used by the mockup: 300 / 400 / 500 / 600. */
export type Weight = 300 | 400 | 500 | 600;

const JOST: Record<Weight, string> = {
  300: 'Jost_300Light',
  400: 'Jost_400Regular',
  500: 'Jost_500Medium',
  600: 'Jost_600SemiBold',
};

const PLAYFAIR: Record<500 | 600, string> = {
  500: 'PlayfairDisplay_500Medium',
  600: 'PlayfairDisplay_600SemiBold',
};

/** Every font file the app loads, keyed by the family name RN will reference. */
export const fontMap = {
  Jost_300Light: require('@expo-google-fonts/jost/300Light/Jost_300Light.ttf'),
  Jost_400Regular: require('@expo-google-fonts/jost/400Regular/Jost_400Regular.ttf'),
  Jost_500Medium: require('@expo-google-fonts/jost/500Medium/Jost_500Medium.ttf'),
  Jost_600SemiBold: require('@expo-google-fonts/jost/600SemiBold/Jost_600SemiBold.ttf'),
  PlayfairDisplay_500Medium: require('@expo-google-fonts/playfair-display/500Medium/PlayfairDisplay_500Medium.ttf'),
  PlayfairDisplay_600SemiBold: require('@expo-google-fonts/playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf'),
};

type BaseProps = TextProps & {
  size?: number;
  color?: string;
  /** Letter spacing in em, as authored in the mockup's CSS. */
  tracking?: number;
  align?: TextStyle['textAlign'];
  lineHeight?: number;
};

export type TxtProps = BaseProps & { weight?: Weight };

export function Txt({
  weight = 400,
  size = 13,
  color = colors.ink,
  tracking,
  align,
  lineHeight,
  style,
  ...rest
}: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: JOST[weight],
          fontSize: size,
          color,
          ...(tracking !== undefined ? { letterSpacing: tracking * size } : null),
          ...(align ? { textAlign: align } : null),
          ...(lineHeight ? { lineHeight } : null),
        },
        style,
      ]}
    />
  );
}

export type DisplayProps = BaseProps & { weight?: 500 | 600 };

export function Display({
  weight = 600,
  size = 22,
  color = colors.ink,
  tracking,
  align,
  lineHeight,
  style,
  ...rest
}: DisplayProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: PLAYFAIR[weight],
          fontSize: size,
          color,
          ...(tracking !== undefined ? { letterSpacing: tracking * size } : null),
          ...(align ? { textAlign: align } : null),
          ...(lineHeight ? { lineHeight } : null),
        },
        style,
      ]}
    />
  );
}

/** The small all-caps field labels: `NAMA PRODUK`, `SKU`, `KATEGORI`, … */
export function Label({ children, style, ...rest }: TxtProps) {
  return (
    <Txt size={11} weight={400} color={colors.faint} tracking={0.16} style={style} {...rest}>
      {children}
    </Txt>
  );
}

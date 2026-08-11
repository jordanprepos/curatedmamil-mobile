import { Platform, type ViewStyle } from 'react-native';

/**
 * Design tokens lifted verbatim from `Mami L Dashboard App.dc.html`.
 * Every colour here appears in the mockup — don't invent new ones.
 */
export const colors = {
  primary: '#A07D77',
  primaryPressed: '#8E6B65',

  ink: '#2B2320',
  muted: '#8C7D75',
  faint: '#A9998F',
  subtle: '#6B5C55',

  bgApp: '#FBF7F4',
  bgPage: '#F3EBE6',
  surface: '#FFFFFF',
  chip: '#F1E9E4',

  border: '#E5D9D3',
  divider: '#F0E6E0',
  placeholder: '#B6A79F',

  onPrimary: '#FFFFFF',

  /** The mockup's inline-error red. Also the destructive-action accent. */
  danger: '#B4524B',
} as const;

/** Product statuses. `Draf` only appears on the Tambah screen in the mockup. */
export const STATUSES = ['Aktif', 'Ditahan', 'Terjual', 'Arsip', 'Draf'] as const;
export type Status = (typeof STATUSES)[number];

/** Statuses offered as filter tabs on Dasbor, in mockup order. */
export const FILTER_TABS = ['Semua', 'Aktif', 'Terjual', 'Arsip'] as const;
export type FilterTab = (typeof FILTER_TABS)[number];

/** Statuses offered when creating a product, in mockup order. */
export const NEW_STATUSES = ['Aktif', 'Ditahan', 'Draf'] as const;

export const CATEGORIES = ['Tote', 'Selempang', 'Clutch', 'Bahu'] as const;
export type Category = (typeof CATEGORIES)[number];

type Pair = { bg: string; fg: string };

export const statusColors: Record<Status, Pair> = {
  Aktif: { bg: '#E8F1E9', fg: '#4F7D5E' },
  Ditahan: { bg: '#E7EEF6', fg: '#5A7CA0' },
  Terjual: { bg: '#FBF0DC', fg: '#A87A2C' },
  Arsip: { bg: '#F0EDEB', fg: '#8C7D75' },
  // Not in the mockup's STATUS map — reuses the Arsip pair, its nearest neighbour.
  Draf: { bg: '#F0EDEB', fg: '#8C7D75' },
};

export const ORDER_STATES = ['Baru', 'Dikirim', 'Selesai'] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const orderStateColors: Record<OrderState, Pair> = {
  Baru: { bg: '#F1E4E2', fg: '#A07D77' },
  Dikirim: { bg: '#E7EEF6', fg: '#5A7CA0' },
  Selesai: { bg: '#E8F1E9', fg: '#4F7D5E' },
};

/** Accent dots on the Ringkasan stat tiles. */
export const statDotColors = {
  total: { dot: '#A07D77', bg: '#F1E9E4' },
  aktif: { dot: '#4F7D5E', bg: '#E8F1E9' },
  terjual: { dot: '#D9A441', bg: '#FBF0DC' },
  arsip: { dot: '#A9A29D', bg: '#F0EDEB' },
} as const;

export const radius = {
  card: 18,
  input: 14,
  thumb: 14,
  rowThumb: 12,
  tile: 12,
  pill: 999,
} as const;

export const space = {
  screenX: 20,
} as const;

/**
 * The mockup's `0 1px 3px rgba(43,35,32,0.06)`. React Native needs this split
 * across shadow* (iOS), elevation (Android) and boxShadow (web).
 *
 * Deliberately narrowed to shadow properties only, so it composes into both
 * View and TextInput styles — a full ViewStyle clashes with TextStyle on
 * `userSelect`.
 */
type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'shadowOffset' | 'elevation'
> & { boxShadow?: string };

export const cardShadow: ShadowStyle = Platform.select<ShadowStyle>({
  ios: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  android: { elevation: 1 },
  default: { boxShadow: '0 1px 3px rgba(43,35,32,0.06)' },
})!;

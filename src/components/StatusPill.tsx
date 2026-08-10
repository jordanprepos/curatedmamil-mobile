import { View, type ViewStyle } from 'react-native';
import { Txt } from '../theme/text';
import {
  orderStateColors,
  radius,
  statusColors,
  type OrderState,
  type Status,
} from '../theme/tokens';

type Props = {
  label: string;
  bg: string;
  fg: string;
  size?: number;
  style?: ViewStyle;
};

function Pill({ label, bg, fg, size = 11, style }: Props) {
  return (
    <View
      style={[
        {
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: radius.pill,
          backgroundColor: bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Txt size={size} weight={500} color={fg}>
        {label}
      </Txt>
    </View>
  );
}

export function StatusPill({
  status,
  size,
  style,
}: {
  status: Status;
  size?: number;
  style?: ViewStyle;
}) {
  const c = statusColors[status] ?? statusColors.Arsip;
  return <Pill label={status} bg={c.bg} fg={c.fg} size={size} style={style} />;
}

export function OrderStatePill({
  state,
  size,
  style,
}: {
  state: OrderState;
  size?: number;
  style?: ViewStyle;
}) {
  const c = orderStateColors[state] ?? orderStateColors.Baru;
  return <Pill label={state} bg={c.bg} fg={c.fg} size={size ?? 12} style={style} />;
}

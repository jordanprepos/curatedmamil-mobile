import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { PillButton } from '../../src/components/PillButton';
import { OrderStatePill } from '../../src/components/StatusPill';
import { useShopData } from '../../src/data/store';
import {
  cancelOrder,
  countNewOrders,
  restoreOrder,
  setOrderState,
  type Order,
} from '../../src/data/orders';
import { rupiah } from '../../src/lib/format';
import { withWriteTimeout, writeErrorMessage } from '../../src/lib/write';
import { Txt } from '../../src/theme/text';
import {
  cancelColors,
  colors,
  orderStateColors,
  radius,
  space,
  statusColors,
  type OrderState,
} from '../../src/theme/tokens';

/**
 * The status groups, in the fixed order they render in. Groups with no orders
 * are skipped entirely — no empty states and no zero counts, so the page only
 * ever shows work that exists.
 */
const GROUPS: { state: OrderState; heading: string; sub: string }[] = [
  {
    state: 'Baru',
    heading: 'Perlu dibalas',
    sub: 'Pembeli sedang menunggu jawaban kamu',
  },
  {
    state: 'Dikirim',
    heading: 'Sedang dikirim',
    sub: 'Sudah dibayar, paket dalam perjalanan',
  },
  {
    state: 'Selesai',
    heading: 'Selesai',
    sub: 'Pesanan sudah diterima pembeli',
  },
  {
    state: 'Dibatalkan',
    heading: 'Dibatalkan',
    sub: 'Tidak jadi dilanjutkan',
  },
];

/** The states GROUPS already covers, so the catch-all can skip them. */
const KNOWN_STATES = new Set<string>(GROUPS.map((g) => g.state));

export default function Pesanan() {
  const insets = useSafeAreaInsets();
  const { orders, shop, loading, error } = useShopData();
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * The one card currently asking "are you sure?", or null.
   *
   * Local component state on purpose, and the only piece of this feature that
   * is: a half-finished confirmation is a property of this screen right now,
   * not of the order. The cancellation itself goes to Firestore — see
   * `cancelOrder`.
   */
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  /**
   * Orders bucketed by `state` in a single pass. Insertion order preserves the
   * `createdAt desc` sort Firestore already applied (and none of the writes here
   * touch `createdAt`), so cards stay put within a group. States outside the four
   * known GROUPS still land here and are rendered under a catch-all below — a
   * hand-edited console value or a future state never silently disappears.
   */
  const byState = new Map<string, Order[]>();
  for (const o of orders) {
    const bucket = byState.get(o.state);
    if (bucket) bucket.push(o);
    else byState.set(o.state, [o]);
  }
  // Counted through the shared helper, not `byState`, so "new" stays defined in
  // one place — the Dasbor badge (index.tsx) reads it too and the two must agree.
  const newCount = countNewOrders(orders);

  /**
   * The small caption under the title. Null when the body already tells the
   * story — a listener error surfaces its own banner below, and an empty catalog
   * shows its own "Belum ada pesanan" — so the header never contradicts or
   * duplicates it.
   */
  const subtitle = loading
    ? 'Memuat…'
    : error || orders.length === 0
      ? null
      : newCount > 0
        ? `${newCount} pesanan perlu dibalas`
        : 'Semua pesanan sudah ditangani';

  /**
   * Same deep link as the mockup's `onChat`, with `window.open` swapped for
   * Linking. The buyer's own number is preferred when we have one; otherwise it
   * falls back to the shop number from shop/config.
   */
  async function chat(order: Order) {
    const number = order.phone?.trim() || shop.whatsappNumber;
    const text = encodeURIComponent(
      `Halo ${order.buyer}, terima kasih atas pesanan ${order.itemName}.`,
    );
    const url = `https://wa.me/${number}?text=${text}`;

    try {
      await Linking.openURL(url);
    } catch {
      setActionError('Tidak bisa membuka WhatsApp.');
    }
  }

  async function markDone(order: Order) {
    setActionError(null);
    try {
      await withWriteTimeout(setOrderState(order.id, 'Selesai'));
    } catch (e) {
      setActionError(writeErrorMessage(e, 'Gagal memperbarui pesanan. Coba lagi.'));
    }
  }

  async function cancel(order: Order) {
    setActionError(null);
    try {
      await withWriteTimeout(cancelOrder(order.id, order.state));
      // Dismissed only once the write is acknowledged. Clearing it up front
      // would close the panel on a cancel that then failed, which reads as
      // "cancelled" while the order is still sitting in its old group.
      setConfirmCancelId(null);
    } catch (e) {
      // Close the panel whatever went wrong. On a rejection (e.g.
      // permission-denied) the optimistic cancel is rolled back and the card
      // returns to its old group; on a timeout the write stays queued and the
      // card stays in Dibatalkan showing "Aktifkan lagi" — in neither case
      // should the confirm panel linger beside the error banner.
      setConfirmCancelId(null);
      setActionError(writeErrorMessage(e, 'Gagal membatalkan pesanan. Coba lagi.'));
    }
  }

  async function restore(order: Order) {
    setActionError(null);
    try {
      await withWriteTimeout(restoreOrder(order.id, order.stateBeforeCancel));
    } catch (e) {
      setActionError(writeErrorMessage(e, 'Gagal mengaktifkan pesanan. Coba lagi.'));
    }
  }

  /** One status section: coloured header plus its order cards. Empty or absent
   *  groups render nothing. Shared by the known GROUPS and the catch-all. */
  function renderGroup(
    state: string,
    heading: string,
    sub: string,
    inGroup: Order[] | undefined,
  ) {
    if (!inGroup || inGroup.length === 0) return null;

    return (
      <View key={state} style={{ gap: 10 }}>
        <GroupHeader state={state} heading={heading} sub={sub} count={inGroup.length} />

        {inGroup.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            confirming={confirmCancelId === o.id}
            onChat={() => chat(o)}
            onDone={() => markDone(o)}
            onAskCancel={() => {
              setActionError(null);
              setConfirmCancelId(o.id);
            }}
            onDismissCancel={() => setConfirmCancelId(null)}
            onConfirmCancel={() => cancel(o)}
            onRestore={() => restore(o)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.screenX }}>
        <Txt size={26} weight={600}>
          Pesanan
        </Txt>
        {subtitle ? (
          <Txt size={14} weight={300} color={colors.muted} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 22,
          paddingTop: 18,
          paddingBottom: 12,
          paddingHorizontal: space.screenX,
        }}
      >
        {error || actionError ? (
          <Txt size={13} weight={300} color={colors.muted} align="center">
            {error ?? actionError}
          </Txt>
        ) : null}

        {GROUPS.map(({ state, heading, sub }) =>
          renderGroup(state, heading, sub, byState.get(state)),
        )}

        {/* Anything whose state isn't one of the four GROUPS — a value edited by
            hand in the console, a legacy doc, or a state added in a later version.
            Shown under its own heading rather than dropped, so it stays visible
            and actionable. */}
        {[...byState.keys()]
          .filter((state) => !KNOWN_STATES.has(state))
          .map((state) => {
            // A doc with a missing `state` buckets under `undefined`; label it so
            // the section still has a heading, a stable key, and a real pill.
            const label = state || 'Tanpa status';
            return renderGroup(label, label, 'Status tidak dikenal', byState.get(state));
          })}

        {!loading && !error && orders.length === 0 ? (
          <Txt
            size={13}
            weight={300}
            color={colors.faint}
            align="center"
            style={{ marginTop: 30 }}
          >
            Belum ada pesanan.
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Coloured dot, heading, count pill, and the grey line underneath. */
function GroupHeader({
  state,
  heading,
  sub,
  count,
}: {
  state: string;
  heading: string;
  sub: string;
  count: number;
}) {
  // Unknown catch-all states get the neutral grey Arsip pair, not Baru's pink —
  // a stale/unrecognised status must not wear the "needs attention" colour.
  const c = orderStateColors[state as OrderState] ?? statusColors.Arsip;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: c.fg,
          }}
        />
        <Txt size={14} weight={500}>
          {heading}
        </Txt>
        <View
          style={{
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: radius.pill,
            backgroundColor: c.bg,
          }}
        >
          <Txt size={12} weight={500} color={c.fg}>
            {count}
          </Txt>
        </View>
      </View>
      <Txt size={12.5} weight={300} color={colors.faint} style={{ marginTop: 3 }}>
        {sub}
      </Txt>
    </View>
  );
}

function OrderCard({
  order,
  confirming,
  onChat,
  onDone,
  onAskCancel,
  onDismissCancel,
  onConfirmCancel,
  onRestore,
}: {
  order: Order;
  confirming: boolean;
  onChat: () => void;
  onDone: () => void;
  onAskCancel: () => void;
  onDismissCancel: () => void;
  onConfirmCancel: () => void;
  onRestore: () => void;
}) {
  const cancelled = order.state === 'Dibatalkan';
  // Nothing left to cancel once it is finished or already cancelled.
  const cancellable = !cancelled && order.state !== 'Selesai';

  return (
    <Card style={{ paddingVertical: 14, paddingHorizontal: 16, opacity: cancelled ? 0.62 : 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <Txt
          size={13.5}
          weight={500}
          style={{ flex: 1, ...(cancelled ? { textDecorationLine: 'line-through' } : null) }}
        >
          {order.buyer}
        </Txt>
        <OrderStatePill state={order.state} />
      </View>

      <Txt size={13} weight={300} color={colors.muted} style={{ marginTop: 6 }}>
        {order.itemName} · {rupiah(order.price)}
      </Txt>

      {cancelled ? (
        <View style={{ marginTop: 12 }}>
          <PillButton
            label="Aktifkan lagi"
            variant="outline"
            block
            onPress={onRestore}
            size={12}
            paddingVertical={10}
          />
        </View>
      ) : confirming ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: radius.input,
            backgroundColor: cancelColors.surface,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <Txt size={12.5} weight={300} color={cancelColors.text} lineHeight={18}>
            {`Batalkan pesanan ${order.itemName} dari ${order.buyer}? Pembeli sebaiknya dikabari lewat WhatsApp.`}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <PillButton
              label="Ya, batalkan"
              onPress={onConfirmCancel}
              tone={{
                bg: cancelColors.accent,
                pressedBg: cancelColors.accentPressed,
                label: colors.onPrimary,
              }}
              size={12}
              paddingVertical={10}
              style={{ flex: 1 }}
            />
            <PillButton
              label="Kembali"
              variant="outline"
              onPress={onDismissCancel}
              size={12}
              paddingVertical={10}
              paddingHorizontal={16}
            />
          </View>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <PillButton
              label="Balas di WhatsApp"
              onPress={onChat}
              size={12}
              paddingVertical={10}
              style={{ flex: 1 }}
            />
            <PillButton
              label="Selesai"
              variant="outline"
              onPress={onDone}
              disabled={order.state === 'Selesai'}
              size={12}
              paddingVertical={10}
              paddingHorizontal={16}
            />
          </View>

          {cancellable ? (
            <PillButton
              label="Batalkan pesanan"
              variant="plain"
              block
              onPress={onAskCancel}
              tone={{
                // Transparent at rest so it reads as tertiary against the card,
                // warming to the panel's own colour under a finger.
                bg: 'transparent',
                pressedBg: cancelColors.surface,
                border: cancelColors.border,
                label: cancelColors.accent,
              }}
              size={12}
              paddingVertical={9}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

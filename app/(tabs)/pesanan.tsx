import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { PillButton } from '../../src/components/PillButton';
import { OrderStatePill } from '../../src/components/StatusPill';
import { useShopData } from '../../src/data/store';
import { countNewOrders, setOrderState, type Order } from '../../src/data/orders';
import { rupiah } from '../../src/lib/format';
import { Txt } from '../../src/theme/text';
import { colors, space } from '../../src/theme/tokens';

export default function Pesanan() {
  const insets = useSafeAreaInsets();
  const { orders, shop, loading, error } = useShopData();
  const [actionError, setActionError] = useState<string | null>(null);

  const newCount = countNewOrders(orders);

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
      await setOrderState(order.id, 'Selesai');
    } catch {
      setActionError('Gagal memperbarui pesanan. Coba lagi.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.screenX }}>
        <Txt size={26} weight={600}>
          Pesanan
        </Txt>
        <Txt size={14} weight={300} color={colors.muted} style={{ marginTop: 2 }}>
          {loading
            ? 'Memuat…'
            : `${newCount} pesanan baru dari WhatsApp`}
        </Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 12,
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

        {orders.map((o) => (
          <Card key={o.id} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Txt size={13.5} weight={500} style={{ flex: 1 }}>
                {o.buyer}
              </Txt>
              <OrderStatePill state={o.state} />
            </View>

            <Txt size={13} weight={300} color={colors.muted} style={{ marginTop: 6 }}>
              {o.itemName} · {rupiah(o.price)}
            </Txt>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <PillButton
                label="Balas di WhatsApp"
                onPress={() => chat(o)}
                size={12}
                paddingVertical={10}
                style={{ flex: 1 }}
              />
              <PillButton
                label="Selesai"
                variant="outline"
                onPress={() => markDone(o)}
                disabled={o.state === 'Selesai'}
                size={12}
                paddingVertical={10}
                paddingHorizontal={16}
              />
            </View>
          </Card>
        ))}

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

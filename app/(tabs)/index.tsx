import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { PillButton } from '../../src/components/PillButton';
import { ProductImage } from '../../src/components/ProductImage';
import { StatusPill } from '../../src/components/StatusPill';
import { useShopData } from '../../src/data/store';
import { countNewOrders } from '../../src/data/orders';
import { filterByTab, searchProducts, type Product } from '../../src/data/products';
import { rupiah } from '../../src/lib/format';
import { Display, Txt } from '../../src/theme/text';
import {
  colors,
  FILTER_TABS,
  radius,
  space,
  type FilterTab,
  type Status,
} from '../../src/theme/tokens';

export default function Dasbor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { products, orders, loading, error } = useShopData();

  const [tab, setTab] = useState<FilterTab>('Semua');
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () => searchProducts(filterByTab(products, tab), query),
    [products, tab, query],
  );

  const newOrders = countNewOrders(orders);

  /** Counts on the filter tabs, live from Firestore rather than the mockup's fixed 42/28/10/4. */
  function tabCount(t: FilterTab): number {
    return t === 'Semua'
      ? products.length
      : products.filter((p) => p.status === (t as Status)).length;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      {/* Header: hamburger, wordmark, orders bag with new-order badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: space.screenX,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka ringkasan"
          onPress={() => router.push('/lainnya')}
          style={{ width: 22, gap: 4, paddingVertical: 4 }}
        >
          <View style={{ height: 2, backgroundColor: colors.ink }} />
          <View style={{ height: 2, backgroundColor: colors.ink }} />
          <View style={{ height: 2, backgroundColor: colors.ink }} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Txt size={8} tracking={0.3} color={colors.faint}>
            CURATED 2026
          </Txt>
          <Display size={22} weight={500} tracking={0.04}>
            Mami L
          </Display>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pesanan, ${newOrders} baru`}
          onPress={() => router.push('/pesanan')}
          style={{ width: 24, height: 24 }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderWidth: 1.5,
              borderColor: colors.ink,
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            }}
          />
          {newOrders > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={10} color={colors.onPrimary}>
                {newOrders}
              </Txt>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Title + add */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingTop: 6,
          paddingHorizontal: space.screenX,
        }}
      >
        <View>
          <Txt size={26} weight={600} tracking={-0.01}>
            Dasbor
          </Txt>
          <Txt size={13} weight={300} color={colors.muted} style={{ marginTop: 2 }}>
            {loading ? 'Memuat…' : `${products.length} Produk`}
          </Txt>
        </View>
        <PillButton
          label="+ Tambah"
          onPress={() => router.push('/tambah')}
          paddingVertical={11}
          size={12.5}
        />
      </View>

      {/* Search + reset */}
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingTop: 16,
          paddingHorizontal: space.screenX,
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari produk..."
          placeholderTextColor={colors.placeholder}
          autoCorrect={false}
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: radius.input,
            backgroundColor: colors.chip,
            fontFamily: 'Jost_300Light',
            fontSize: 13,
            color: colors.ink,
          }}
        />
        <PillButton
          label="Atur"
          variant="outline"
          // Mirrors the mockup's onClear: resets the query *and* the tab.
          onPress={() => {
            setQuery('');
            setTab('Semua');
          }}
          paddingVertical={12}
          size={13}
          style={{ borderRadius: radius.input }}
        />
      </View>

      {/* Status filter tabs */}
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingTop: 14,
          paddingBottom: 4,
          paddingHorizontal: space.screenX,
        }}
      >
        {FILTER_TABS.map((t) => (
          <Chip
            key={t}
            label={`${t} ${tabCount(t)}`}
            selected={tab === t}
            onPress={() => setTab(t)}
            flex
            size={11.5}
            paddingHorizontal={4}
          />
        ))}
      </View>

      {/* Product list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 12,
          paddingTop: 14,
          paddingBottom: 12,
          paddingHorizontal: space.screenX,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Txt
            size={13}
            weight={300}
            color={colors.muted}
            align="center"
            style={{ marginTop: 30 }}
          >
            {error}
          </Txt>
        ) : null}

        {visible.map((p) => (
          <ProductCard key={p.id} product={p} onPress={() => router.push(`/produk/${p.id}`)} />
        ))}

        {!loading && !error && visible.length === 0 ? (
          <Txt
            size={13}
            weight={300}
            color={colors.faint}
            align="center"
            style={{ marginTop: 30 }}
          >
            Tidak ada produk yang cocok.
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
      <View style={{ width: 64, height: 64 }}>
        <ProductImage uri={product.imageUrl} name={product.name} radius={radius.thumb} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Txt size={13} weight={500} lineHeight={16} style={{ flex: 1 }}>
            {product.name}
          </Txt>
          <StatusPill status={product.status} />
        </View>

        <Txt size={13} weight={500} color={colors.primary} style={{ marginTop: 5 }}>
          {rupiah(product.price)}
        </Txt>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <Txt size={11} weight={300} color={colors.faint}>
            SKU: {product.sku}
          </Txt>
          <Txt size={11} color={colors.subtle}>
            Ubah
          </Txt>
        </View>
      </View>
    </Card>
  );
}

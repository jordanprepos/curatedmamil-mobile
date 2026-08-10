import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductImage } from '../../src/components/ProductImage';
import { StatusPill } from '../../src/components/StatusPill';
import { useShopData } from '../../src/data/store';
import { rupiah } from '../../src/lib/format';
import { Txt } from '../../src/theme/text';
import { colors, radius, space } from '../../src/theme/tokens';

export default function SemuaProduk() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { products, loading, error } = useShopData();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.screenX }}>
        <Txt size={26} weight={600}>
          Semua Produk
        </Txt>
        <Txt size={17} weight={300} color={colors.muted} style={{ marginTop: 2 }}>
          Ketuk produk untuk melihat detail
        </Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 18,
          paddingBottom: 12,
          paddingHorizontal: space.screenX,
        }}
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

        {products.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            onPress={() => router.push(`/produk/${p.id}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ width: 48, height: 48 }}>
              <ProductImage
                uri={p.imageUrl}
                name={p.name}
                radius={radius.rowThumb}
                monogramSize={14}
              />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt size={13.5} weight={500}>
                {p.name}
              </Txt>
              <Txt size={12} weight={300} color={colors.muted} style={{ marginTop: 3 }}>
                {rupiah(p.price)} · {p.sku}
              </Txt>
            </View>

            <StatusPill status={p.status} size={10.5} />
          </Pressable>
        ))}

        {!loading && !error && products.length === 0 ? (
          <Txt
            size={13}
            weight={300}
            color={colors.faint}
            align="center"
            style={{ marginTop: 30 }}
          >
            Belum ada produk.
          </Txt>
        ) : null}
      </ScrollView>
    </View>
  );
}

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../../src/components/Card';
import { PillButton } from '../../../src/components/PillButton';
import { ProductImage } from '../../../src/components/ProductImage';
import { StatusPill } from '../../../src/components/StatusPill';
import { useShopData } from '../../../src/data/store';
import { setProductStatus } from '../../../src/data/products';
import { rupiah } from '../../../src/lib/format';
import { Display, Label, Txt } from '../../../src/theme/text';
import { colors, radius, space } from '../../../src/theme/tokens';

export default function DetailProduk() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, loading } = useShopData();

  const [busy, setBusy] = useState<'sold' | 'archive' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const product = products.find((p) => p.id === id);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgApp, paddingTop: insets.top + 8 }}>
        <View style={{ paddingHorizontal: space.screenX }}>
          <Pressable accessibilityRole="button" onPress={goBack}>
            <Txt size={13} color={colors.primary}>
              ‹ Kembali
            </Txt>
          </Pressable>
          <Txt
            size={13}
            weight={300}
            color={colors.faint}
            align="center"
            style={{ marginTop: 40 }}
          >
            {loading ? 'Memuat…' : 'Produk tidak ditemukan.'}
          </Txt>
        </View>
      </View>
    );
  }

  async function updateStatus(status: 'Terjual' | 'Arsip', kind: 'sold' | 'archive') {
    if (!product) return;
    setBusy(kind);
    setError(null);
    try {
      await setProductStatus(product.id, status);
      // The mockup returns to Dasbor after archiving; marking sold stays put so
      // the owner can see the pill change.
      if (kind === 'archive') router.replace('/');
    } catch {
      setError('Gagal memperbarui produk. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: space.screenX,
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={goBack}>
          <Txt size={13} color={colors.primary}>
            ‹ Kembali
          </Txt>
        </Pressable>
        <Txt size={15} weight={600}>
          Detail Produk
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/tambah')}
          accessibilityLabel="Ubah produk"
        >
          <Txt size={13} weight={500} color={colors.primary}>
            Ubah
          </Txt>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: space.screenX }}
      >
        <View style={{ height: 220 }}>
          <ProductImage
            uri={product.imageUrl}
            name={product.name}
            radius={radius.card}
            monogramSize={42}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 18,
          }}
        >
          <View style={{ flex: 1 }}>
            <Display size={22} weight={600}>
              {product.name}
            </Display>
            <Txt size={15} weight={500} color={colors.primary} style={{ marginTop: 6 }}>
              {rupiah(product.price)}
            </Txt>
          </View>
          <StatusPill
            status={product.status}
            size={14}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <FactTile label="SKU" value={product.sku} />
          <FactTile label="KATEGORI" value={product.cat} />
        </View>

        {error ? (
          <Txt size={12.5} color="#B4524B" style={{ marginTop: 16 }}>
            {error}
          </Txt>
        ) : null}

        <View style={{ gap: 10, marginTop: 20 }}>
          <PillButton
            label="Tandai Terjual"
            block
            size={13.5}
            loading={busy === 'sold'}
            disabled={busy !== null || product.status === 'Terjual'}
            onPress={() => updateStatus('Terjual', 'sold')}
          />
          <PillButton
            label="Arsipkan Produk"
            variant="outline"
            block
            size={13.5}
            loading={busy === 'archive'}
            disabled={busy !== null}
            onPress={() => updateStatus('Arsip', 'archive')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.input }}>
      <Label size={10.5}>{label}</Label>
      <Txt size={13.5} weight={500} style={{ marginTop: 5 }}>
        {value}
      </Txt>
    </Card>
  );
}

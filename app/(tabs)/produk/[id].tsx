import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../../src/components/Card';
import { PillButton } from '../../../src/components/PillButton';
import { ProductImage } from '../../../src/components/ProductImage';
import { StatusPill } from '../../../src/components/StatusPill';
import { useShopData } from '../../../src/data/store';
import { deleteProduct, productImages, setProductStatus } from '../../../src/data/products';
import { rupiah } from '../../../src/lib/format';
import { deleteProductImages } from '../../../src/lib/storage';
import { withWriteTimeout, writeErrorMessage } from '../../../src/lib/write';
import { Display, Label, Txt } from '../../../src/theme/text';
import { colors, radius, space } from '../../../src/theme/tokens';

export default function DetailProduk() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, loading } = useShopData();

  const [busy, setBusy] = useState<'sold' | 'archive' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /**
   * Set the instant a delete is issued, never cleared.
   *
   * `deleteDoc` hits the local cache before its promise settles, so `products`
   * drops this document while the request is still in flight — and it stays
   * dropped even if the server later rejects it. Without this flag the
   * `!product` early return flashes "Produk tidak ditemukan." over the modal,
   * taking the failure message down with it.
   */
  const removed = useRef(false);

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
          {removed.current ? (
            // Mid-delete: either the router is about to leave, or the write was
            // rejected after the local cache already dropped the document.
            deleteError ? (
              <Txt size={12.5} color={colors.danger} align="center" style={{ marginTop: 40 }}>
                {deleteError}
              </Txt>
            ) : null
          ) : (
            <Txt
              size={13}
              weight={300}
              color={colors.faint}
              align="center"
              style={{ marginTop: 40 }}
            >
              {loading ? 'Memuat…' : 'Produk tidak ditemukan.'}
            </Txt>
          )}
        </View>
      </View>
    );
  }

  async function updateStatus(status: 'Terjual' | 'Arsip', kind: 'sold' | 'archive') {
    if (!product) return;
    setBusy(kind);
    setError(null);
    try {
      await withWriteTimeout(setProductStatus(product.id, status));
      // The mockup returns to Dasbor after archiving; marking sold stays put so
      // the owner can see the pill change.
      if (kind === 'archive') router.replace('/');
    } catch (e) {
      setError(writeErrorMessage(e, 'Gagal memperbarui produk. Coba lagi.'));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!product) return;
    // Captured before the await: `product` resolves from `products`, which this
    // delete is about to empty.
    const productId = product.id;
    /*
      URL FOTO makes it possible to paste one product's photo onto another, and
      those objects must survive this delete.

      The comparison is against every photo of every *other* product, not just
      their covers: a URL that is this product's cover may well be the third
      photo in another product's gallery, and deleting it would blank out a
      picture that product still displays.
    */
    const keep = new Set(
      products.filter((p) => p.id !== productId).flatMap((p) => productImages(p)),
    );
    const doomedImages = productImages(product).filter((url) => !keep.has(url));

    setBusy('delete');
    setDeleteError(null);
    removed.current = true;

    try {
      await withWriteTimeout(deleteProduct(productId));
      // Fire-and-forget: `deleteProductImages` never rejects, and an orphaned
      // object isn't worth delaying the screen the owner is leaving.
      void deleteProductImages(doomedImages);
      setConfirmingDelete(false);
      router.replace('/');
    } catch (e) {
      setDeleteError(writeErrorMessage(e, 'Gagal menghapus produk. Coba lagi.'));
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
        <Gallery images={productImages(product)} name={product.name} />

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
          <Txt size={12.5} color={colors.danger} style={{ marginTop: 16 }}>
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
          <PillButton
            label="Hapus Produk"
            variant="danger"
            block
            size={13.5}
            disabled={busy !== null}
            onPress={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
          />
        </View>
      </ScrollView>

      <Modal
        visible={confirmingDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmingDelete(false)}
      >
        <Pressable
          onPress={() => setConfirmingDelete(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(43,35,32,0.35)',
            justifyContent: 'center',
            paddingHorizontal: space.screenX,
          }}
        >
          {/* Stops taps inside the sheet from dismissing it. */}
          <Pressable
            onPress={() => {}}
            style={{
              borderRadius: radius.card,
              backgroundColor: colors.bgApp,
              padding: 20,
            }}
          >
            <Txt size={15} weight={600}>
              Hapus produk?
            </Txt>
            <Txt
              size={13}
              weight={300}
              color={colors.muted}
              lineHeight={20}
              style={{ marginTop: 10 }}
            >
              {`“${product.name}” akan dihapus permanen beserta fotonya. Tindakan ini tidak bisa dibatalkan — pilih Arsipkan jika Anda hanya ingin menyembunyikannya dari daftar.`}
            </Txt>
            {product.status === 'Terjual' ? (
              <Txt
                size={13}
                weight={300}
                color={colors.muted}
                lineHeight={20}
                style={{ marginTop: 10 }}
              >
                Penjualan produk ini juga akan hilang dari Pendapatan di Ringkasan.
              </Txt>
            ) : null}
            {deleteError ? (
              <Txt size={12.5} color={colors.danger} style={{ marginTop: 10 }}>
                {deleteError}
              </Txt>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <PillButton
                label="Batal"
                variant="outline"
                onPress={() => setConfirmingDelete(false)}
                disabled={busy === 'delete'}
                size={13}
                paddingVertical={13}
                style={{ flex: 1 }}
              />
              <PillButton
                label="Hapus"
                variant="danger"
                onPress={confirmDelete}
                loading={busy === 'delete'}
                size={13}
                paddingVertical={13}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * The product's photos as one swipeable frame, with dots when there is more than
 * one. A single photo (or none) renders exactly what this screen showed before
 * galleries existed — the monogram fallback included, via `ProductImage`.
 *
 * The page width is measured rather than taken from `Dimensions`: this sits
 * inside the screen's horizontal padding, so the window width would overshoot
 * and every page would settle mid-photo. Until the first layout pass reports a
 * width, only the cover is rendered — a paging ScrollView with pages of width 0
 * has no snap positions to land on.
 */
function Gallery({ images, name }: { images: string[]; name: string }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  if (images.length < 2 || !width) {
    return (
      <View style={{ height: 220 }} onLayout={onLayout}>
        <ProductImage uri={images[0]} name={name} radius={radius.card} monogramSize={42} />
      </View>
    );
  }

  return (
    <View onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ height: 220 }}
      >
        {images.map((uri, i) => (
          <View key={`${uri}-${i}`} style={{ width, height: 220 }}>
            <ProductImage
              uri={uri}
              name={name}
              radius={radius.card}
              monogramSize={42}
            />
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignSelf: 'center',
          gap: 6,
          marginTop: 12,
        }}
      >
        {images.map((uri, i) => (
          <View
            key={`dot-${uri}-${i}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === page ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
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

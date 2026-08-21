import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { Chip } from '../../src/components/Chip';
import { Field } from '../../src/components/Field';
import { PillButton } from '../../src/components/PillButton';
import { addProduct, nextSku } from '../../src/data/products';
import { useShopData } from '../../src/data/store';
import { formatRupiahInput, parseRupiah } from '../../src/lib/format';
import {
  deleteProductImages,
  uploadErrorMessage,
  uploadProductImage,
} from '../../src/lib/storage';
import { WriteTimeout, withWriteTimeout, writeErrorMessage } from '../../src/lib/write';
import { Label, Txt } from '../../src/theme/text';
import {
  CATEGORIES,
  cardShadow,
  colors,
  NEW_STATUSES,
  radius,
  space,
  type Category,
  type Status,
} from '../../src/theme/tokens';

/**
 * Photo uploads get a longer leash than a document write — they move real bytes
 * over mobile data. This is only a backstop against `busy` sticking on forever
 * with both save buttons dead; `storage.maxUploadRetryTime` is what normally
 * ends a failing upload, and it is set well inside this bound so the specific
 * Storage error wins over the generic timeout.
 *
 * Applied per photo, not to the gallery as a whole: one budget shared across
 * eight uploads would fire somewhere mid-batch on a slow connection, and the
 * owner would be told the upload was "too slow" when the real answer is that
 * this photo was fine and the next one had not started yet.
 */
const UPLOAD_TIMEOUT_MS = 90_000;

/**
 * Ceiling on photos per product. Nothing in Firestore or storage.rules enforces
 * this — it exists so the owner can't queue a save that spends several minutes
 * uploading, which is indistinguishable from a hang on the Simpan button.
 */
const MAX_PHOTOS = 8;

export default function ProdukBaru() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /*
    Gated on `productsReady`, not `loading`: the latter also waits on the orders
    listener, which this screen doesn't read and which — once it errors — never
    recovers, and the SKU would be blocked on data it never needed.
  */
  const { products, productsReady } = useShopData();

  /**
   * Generated, never typed. Recomputed as the catalog changes so a product added
   * from another device can't be handed the same number, and stable across a
   * single `save()` — which matters, because it also names the uploaded photo
   * objects and that batch can run for minutes.
   */
  const sku = useMemo(() => (productsReady ? nextSku(products) : ''), [products, productsReady]);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState<Category>('Tote');
  const [status, setStatus] = useState<Status>('Aktif');
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setPrice('');
    setCat('Tote');
    setStatus('Aktif');
    setLocalPhotos([]);
    setPhotoUrl('');
    setError(null);
  }

  /**
   * Every photo the product will be saved with, in the order they'll be stored.
   *
   * A pasted URL comes first and therefore becomes the cover — it's the one the
   * owner typed by hand, so it's the deliberate choice of the two sources.
   */
  const pastedUrl = photoUrl.trim();
  const photos = pastedUrl ? [pastedUrl, ...localPhotos] : localPhotos;

  async function pickPhotos() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto per produk.`);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Izin galeri ditolak. Aktifkan di pengaturan perangkat.');
      return;
    }

    /*
      `allowsEditing` is gone on purpose, not by oversight: expo-image-picker
      documents the two as mutually exclusive and silently ignores the crop step
      once multiple selection is on. `selectionLimit` is Android/iOS-only, so the
      cap is re-applied below for web.
    */
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
    });

    if (!result.canceled && result.assets?.length) {
      const picked = result.assets.map((a) => a.uri).slice(0, remaining);
      setLocalPhotos((prev) => [...prev, ...picked]);
      setError(null);
    }
  }

  /** Index is into `photos`, so slot 0 may be the pasted URL rather than a pick. */
  function removePhoto(index: number) {
    setError(null);
    if (pastedUrl && index === 0) {
      setPhotoUrl('');
      return;
    }
    const local = pastedUrl ? index - 1 : index;
    setLocalPhotos((prev) => prev.filter((_, i) => i !== local));
  }

  async function save() {
    const trimmedName = name.trim();
    const value = parseRupiah(price);
    // Captured once: the same string names the photo objects and lands on the
    // document, and `products` can change under a long upload batch.
    const generatedSku = sku;

    if (!trimmedName) return setError('Nama produk wajib diisi.');
    if (value <= 0) return setError('Harga harus lebih dari nol.');
    /*
      Empty only before the catalog snapshot lands. Numbering from an empty list
      would restart at CBML-001 and collide with everything already on the shelf.

      This message is left to clear on the next Simpan rather than on a `sku`
      effect: the copy already tells the owner to retry, and an effect that
      cleared `error` when the SKU arrived would also wipe an unrelated failure
      sitting in the same slot.
    */
    if (!generatedSku) return setError('Menunggu data katalog. Coba lagi sebentar.');

    setBusy(true);
    setError(null);

    /*
      Uploads need a Cloud Storage bucket, which only exists on the Blaze plan.
      One failure aborts the whole save rather than quietly publishing a partial
      gallery, and the copy points at the URL field as the fallback.

      Sequential, not `Promise.all`: eight parallel uploads on mobile data starve
      each other, and a rejection mid-flight would leave the rest still running
      with nothing holding their results.
    */
    const uploaded: string[] = [];
    for (const localUri of localPhotos) {
      try {
        uploaded.push(
          await withWriteTimeout(uploadProductImage(localUri, generatedSku), UPLOAD_TIMEOUT_MS),
        );
      } catch (e) {
        // The photos that already landed belong to a product that will never
        // exist. Best-effort, never rejects — without it every retry of a save
        // that keeps failing on photo 3 orphans two more objects in the bucket.
        void deleteProductImages(uploaded);
        setBusy(false);
        setError(
          e instanceof WriteTimeout
            ? 'Unggah foto terlalu lama. Tempel URL foto sebagai gantinya.'
            : uploadErrorMessage(e),
        );
        return;
      }
    }

    const imageUrls = pastedUrl ? [pastedUrl, ...uploaded] : uploaded;

    try {
      await withWriteTimeout(
        addProduct({
          name: trimmedName,
          price: value,
          sku: generatedSku,
          status,
          cat,
          // `imageUrl` is written alongside the array, holding the cover. The
          // customer-facing website reads that field off these documents and
          // knows nothing about galleries.
          ...(imageUrls.length ? { imageUrl: imageUrls[0], imageUrls } : null),
        }),
      );
      reset();
      router.replace('/');
    } catch (e) {
      setError(writeErrorMessage(e, 'Gagal menyimpan produk. Coba lagi.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            reset();
            router.replace('/');
          }}
        >
          <Txt size={13} color={colors.muted}>
            Batal
          </Txt>
        </Pressable>
        <Txt size={15} weight={600}>
          Produk Baru
        </Txt>
        <Pressable accessibilityRole="button" onPress={save} disabled={busy}>
          <Txt size={13} weight={500} color={busy ? colors.faint : colors.primary}>
            Simpan
          </Txt>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 16,
          paddingTop: 4,
          paddingBottom: 8,
          paddingHorizontal: space.screenX,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          Photo slot — replaces the mockup's <image-slot> drop target. The large
          tile is the cover; the strip under it is the rest of the gallery, and
          only appears once there is something to show.
        */}
        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah foto produk"
            onPress={pickPhotos}
            style={{
              height: 160,
              borderRadius: radius.card,
              overflow: 'hidden',
              backgroundColor: colors.chip,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {photos.length ? (
              <Image
                source={{ uri: photos[0] }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Txt size={13} weight={300} color={colors.faint}>
                Tambah foto produk
              </Txt>
            )}
          </Pressable>

          {photos.length ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                keyboardShouldPersistTaps="handled"
              >
                {photos.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={{ width: 62, height: 62 }}>
                    <Image
                      source={{ uri }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: radius.thumb,
                        backgroundColor: colors.chip,
                      }}
                      resizeMode="cover"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus foto ${i + 1}`}
                      onPress={() => removePhoto(i)}
                      // Generous hit slop: the tap target is a 20px badge sitting
                      // on the corner of a 62px thumbnail.
                      hitSlop={8}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt size={11} weight={500} color={colors.subtle}>
                        ✕
                      </Txt>
                    </Pressable>
                  </View>
                ))}

                {photos.length < MAX_PHOTOS ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tambah foto lagi"
                    onPress={pickPhotos}
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: radius.thumb,
                      backgroundColor: colors.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt size={20} weight={300} color={colors.faint}>
                      +
                    </Txt>
                  </Pressable>
                ) : null}
              </ScrollView>

              <Txt size={11.5} weight={300} color={colors.faint}>
                {`Foto pertama menjadi sampul · ${photos.length}/${MAX_PHOTOS}`}
              </Txt>
            </>
          ) : null}
        </View>

        <Field
          label="NAMA PRODUK"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="mis. Elara Tote"
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Field
            label="HARGA"
            value={price}
            onChangeText={(t) => {
              setPrice(formatRupiahInput(t));
              setError(null);
            }}
            placeholder="Rp 0"
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          {/*
            Diverges from the mockup, which had SKU as a typed field. It is
            generated now and deliberately read-only — still a Field rather than
            a FactTile, so the form reads as a form, but muted to signal that
            there is nothing here to fill in. `…` shows for the moment before the
            catalog snapshot lands.
          */}
          <Field
            label="SKU (OTOMATIS)"
            value={sku || '…'}
            editable={false}
            style={{ color: colors.muted }}
            containerStyle={{ flex: 1 }}
          />
        </View>

        {/*
          Not in the mockup. A real catalog needs a way to attach a photo, and
          Cloud Storage uploads require the Blaze plan — this keeps the screen
          usable on the free tier. It no longer suppresses the picked photos: a
          pasted URL is simply the first entry in the gallery.
        */}
        <Field
          label="URL FOTO (OPSIONAL)"
          value={photoUrl}
          onChangeText={setPhotoUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View>
          <Label style={{ marginBottom: 7 }}>KATEGORI</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} shadow />
            ))}
          </View>
        </View>

        <View>
          <Label style={{ marginBottom: 7 }}>STATUS</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {NEW_STATUSES.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={status === s}
                onPress={() => setStatus(s)}
                flex
                paddingVertical={11}
                paddingHorizontal={0}
                shadow
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          paddingVertical: 14,
          paddingHorizontal: space.screenX,
        }}
      >
        {/*
          The error lives in this fixed footer, not in the scrolling body: the
          form is taller than the viewport, so an error rendered after the STATUS
          chips sits below the fold and a failed Simpan looks like nothing
          happened at all.
        */}
        {error ? (
          <Txt size={12.5} color={colors.danger} style={{ marginBottom: 10 }}>
            {error}
          </Txt>
        ) : null}
        <PillButton
          label="Terbitkan ke Website"
          block
          size={13.5}
          paddingVertical={16}
          loading={busy}
          onPress={save}
          style={{ ...cardShadow }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

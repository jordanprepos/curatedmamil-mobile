import { useState } from 'react';
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
import { addProduct } from '../../src/data/products';
import { formatRupiahInput, parseRupiah } from '../../src/lib/format';
import { uploadErrorMessage, uploadProductImage } from '../../src/lib/storage';
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
 */
const UPLOAD_TIMEOUT_MS = 90_000;

export default function ProdukBaru() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [cat, setCat] = useState<Category>('Tote');
  const [status, setStatus] = useState<Status>('Aktif');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setPrice('');
    setSku('');
    setCat('Tote');
    setStatus('Aktif');
    setLocalPhoto(null);
    setPhotoUrl('');
    setError(null);
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Izin galeri ditolak. Aktifkan di pengaturan perangkat.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setLocalPhoto(result.assets[0].uri);
      setError(null);
    }
  }

  async function save() {
    const trimmedName = name.trim();
    const value = parseRupiah(price);
    const trimmedSku = sku.trim();

    if (!trimmedName) return setError('Nama produk wajib diisi.');
    if (value <= 0) return setError('Harga harus lebih dari nol.');
    if (!trimmedSku) return setError('SKU wajib diisi.');

    setBusy(true);
    setError(null);

    // A pasted URL wins; otherwise try to upload the picked photo. Uploads need
    // a Cloud Storage bucket, which only exists on the Blaze plan — on failure
    // we still save the product and tell the owner to use the URL field.
    let imageUrl = photoUrl.trim() || undefined;
    if (!imageUrl && localPhoto) {
      try {
        imageUrl = await withWriteTimeout(
          uploadProductImage(localPhoto, trimmedSku),
          UPLOAD_TIMEOUT_MS,
        );
      } catch (e) {
        setBusy(false);
        setError(
          e instanceof WriteTimeout
            ? 'Unggah foto terlalu lama. Tempel URL foto sebagai gantinya.'
            : uploadErrorMessage(e),
        );
        return;
      }
    }

    try {
      await withWriteTimeout(
        addProduct({
          name: trimmedName,
          price: value,
          sku: trimmedSku,
          status,
          cat,
          ...(imageUrl ? { imageUrl } : null),
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
        {/* Photo slot — replaces the mockup's <image-slot> drop target */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tambah foto produk"
          onPress={pickPhoto}
          style={{
            height: 160,
            borderRadius: radius.card,
            overflow: 'hidden',
            backgroundColor: colors.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {localPhoto || photoUrl.trim() ? (
            <Image
              source={{ uri: localPhoto ?? photoUrl.trim() }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <Txt size={13} weight={300} color={colors.faint}>
              Tambah foto produk
            </Txt>
          )}
        </Pressable>

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
          <Field
            label="SKU"
            value={sku}
            onChangeText={(t) => {
              setSku(t);
              setError(null);
            }}
            placeholder="CBML-007"
            autoCapitalize="characters"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
          />
        </View>

        {/*
          Not in the mockup. A real catalog needs a way to attach a photo, and
          Cloud Storage uploads require the Blaze plan — this keeps the screen
          usable on the free tier.
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
          <Txt size={12.5} color="#B4524B" style={{ marginBottom: 10 }}>
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

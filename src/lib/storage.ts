import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a picked product photo and returns its public download URL.
 *
 * NOTE: a Cloud Storage bucket is only provisioned on the Blaze (pay-as-you-go)
 * plan. Until billing is enabled on the Firebase project this throws, and the
 * Tambah screen falls back to the "URL foto" field. Everything else in the app
 * works on the free Spark plan.
 */
export async function uploadProductImage(localUri: string, sku: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  const contentType = blob.type || 'image/jpeg';
  const safeSku = sku.trim().replace(/[^A-Za-z0-9_-]/g, '') || 'produk';
  const objectRef = ref(
    storage,
    `products/${safeSku}-${Date.now()}.${extensionFor(contentType, localUri)}`,
  );

  // storage.rules requires an `image/*` contentType. `fetch()` on a native
  // `file://` URI can hand back a blob with an empty type, which uploads as
  // application/octet-stream and gets rejected — so it is always set here.
  await uploadBytes(objectRef, blob, { contentType });
  return getDownloadURL(objectRef);
}

/**
 * Picks the object's file extension.
 *
 * The MIME type is the reliable source: on web `expo-image-picker` returns a
 * `blob:http://host/uuid` URI which contains no dot at all, so naively taking
 * the text after the last dot yields the entire URI. That lands `:` and `/` in
 * the object path, which both mangles the name and pushes it out of
 * storage.rules' single-segment `match /products/{fileName}` into the
 * deny-everything branch.
 */
function extensionFor(contentType: string, localUri: string): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
  };

  const fromType = known[contentType.toLowerCase()];
  if (fromType) return fromType;

  // Native `file://` URIs do carry a real extension; accept it only if it looks
  // like one rather than trusting whatever followed the last dot.
  const tail = localUri.split('?')[0].split('.').pop() ?? '';
  return /^[A-Za-z0-9]{2,5}$/.test(tail) ? tail.toLowerCase() : 'jpg';
}

/** Indonesian copy for an upload failure, shown inline on the Tambah screen. */
export function uploadErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'storage/unauthorized') return 'Tidak punya izin mengunggah foto.';

  /*
    With no bucket provisioned every attempt fails as a bare network error, so
    the SDK burns through its retries and reports `retry-limit-exceeded` — the
    same code a genuinely flaky connection produces. They're indistinguishable
    here, so the copy names both causes rather than blaming the connection.
  */
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return 'Gagal mengunggah foto — penyimpanan belum aktif atau koneksi terputus. Tempel URL foto sebagai gantinya.';
  }

  return 'Gagal mengunggah foto. Tempel URL foto sebagai gantinya.';
}

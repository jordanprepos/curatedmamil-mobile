import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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

/**
 * Best-effort removal of a product photo we uploaded. Never rejects.
 *
 * Failure is swallowed on purpose. The record the owner sees is the Firestore
 * document, which is already gone by the time this runs; the worst outcome here
 * is an orphaned object in the bucket, which nothing in the app surfaces. There
 * is deliberately no `deleteErrorMessage` counterpart to `uploadErrorMessage`.
 */
export async function deleteProductImage(imageUrl: string | undefined): Promise<void> {
  const path = ourObjectPath(imageUrl);
  if (!path) return;

  try {
    await deleteObject(ref(storage, path));
  } catch {
    // storage/object-not-found (already gone), storage/unauthorized, a blocked
    // preflight — nothing worth telling the owner, the product itself is gone.
  }
}

/**
 * The object path inside our own bucket, or null if this URL isn't one of our
 * uploads.
 *
 * `imageUrl` is not necessarily ours: the Tambah screen's URL FOTO field takes
 * any hosted image. And the storage path is never persisted on the product doc
 * — only the download URL — so the path is recovered by parsing that URL.
 *
 * Deliberately not `ref(storage, imageUrl)`: that helper also accepts
 * `storage.googleapis.com/<any-bucket>/<path>`, so a pasted link to an
 * unrelated public bucket would hand back a perfectly valid reference to
 * someone else's file. It also throws `storage/invalid-url` synchronously on
 * anything it can't parse. Matching the configured bucket ourselves avoids both.
 */
function ourObjectPath(imageUrl: string | undefined): string | null {
  const bucket = storage.app.options.storageBucket;
  if (!imageUrl || !bucket) return null;

  const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^https?://[^/]+/v0/b/${escaped}/o/([^?#]+)`).exec(imageUrl);
  if (!match) return null;

  try {
    // Download URLs percent-encode the path: `products%2FSKU-1786394163368.jpg`.
    const path = decodeURIComponent(match[1]);
    // One segment under products/ — what storage.rules matches, and what
    // `uploadProductImage` writes.
    return /^products\/[^/]+$/.test(path) ? path : null;
  } catch {
    // decodeURIComponent throws on a malformed escape sequence.
    return null;
  }
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

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

  const extension = localUri.split('.').pop()?.split('?')[0] ?? 'jpg';
  const safeSku = sku.trim().replace(/[^A-Za-z0-9_-]/g, '') || 'produk';
  const objectRef = ref(storage, `products/${safeSku}-${Date.now()}.${extension}`);

  await uploadBytes(objectRef, blob);
  return getDownloadURL(objectRef);
}

/** Indonesian copy for an upload failure, shown inline on the Tambah screen. */
export function uploadErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'storage/unauthorized') return 'Tidak punya izin mengunggah foto.';
  if (code === 'storage/retry-limit-exceeded') return 'Koneksi lambat. Coba lagi.';
  return 'Gagal mengunggah foto. Tempel URL foto sebagai gantinya.';
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Category, Status } from '../theme/tokens';

export type Product = {
  id: string;
  name: string;
  /** Rupiah, as an integer. Formatted for display by lib/format.ts. */
  price: number;
  sku: string;
  status: Status;
  cat: Category;
  /**
   * The cover photo — also `imageUrls[0]` when there is a gallery.
   *
   * Kept as its own field, and kept first, because the customer-facing website
   * (a separate repo) reads `imageUrl` off these documents. Dropping it or
   * folding it into the array would break a consumer this repo can't fix.
   */
  imageUrl?: string;
  /**
   * Every photo, cover included, in display order. Absent on documents written
   * before galleries existed — read it through `productImages` rather than
   * directly, which falls back to the lone `imageUrl`.
   */
  imageUrls?: string[];
  createdAt?: Timestamp;
  soldAt?: Timestamp;
};

/**
 * A product's photos as one list, oldest documents included.
 *
 * `imageUrls` is the source of truth once present; products created before
 * multi-photo support carry only `imageUrl`, and the seeded demo catalog carries
 * neither. This helper is the entire migration — there is no backfill.
 */
export function productImages(p: Pick<Product, 'imageUrl' | 'imageUrls'>): string[] {
  if (p.imageUrls?.length) return p.imageUrls;
  return p.imageUrl ? [p.imageUrl] : [];
}

/**
 * SKU prefix for the whole catalog — "Curated By Mami L".
 *
 * Deliberately not per-category: the catalog numbers flat across all four
 * categories (`CBML-001`…`CBML-005` in the seed spans Tote, Selempang, Bahu and
 * Clutch), and a product's category can change while its SKU must not.
 */
const SKU_PREFIX = 'CBML-';

/** Matches our own SKUs. Case-insensitive so a hand-entered `cbml-006` counts. */
const SKU_PATTERN = /^CBML-(\d+)$/i;

/**
 * The SKU the next product should get: one past the highest number in use.
 *
 * SKUs that don't match our pattern are ignored rather than guessed at — the
 * catalog predates this generator and a hand-written `TOTE-A` shouldn't stop the
 * count. Padded to three digits, widening naturally past `CBML-999`.
 *
 * Uniqueness is not enforced anywhere — not by rules, not by an index. Two
 * devices saving at the same instant can land on the same number, and deleting
 * the highest-numbered product frees it for reuse. Both are accepted: this is a
 * single-owner shop, the optimistic local echo advances the number immediately
 * on a same-device second save, and `Arsip` means deletion is the rare path.
 * A counter document would trade that for a write on every save.
 */
export function nextSku(items: readonly Pick<Product, 'sku'>[]): string {
  let highest = 0;
  for (const item of items) {
    const match = SKU_PATTERN.exec(item.sku?.trim() ?? '');
    if (!match) continue;
    highest = Math.max(highest, parseInt(match[1], 10));
  }
  return `${SKU_PREFIX}${String(highest + 1).padStart(3, '0')}`;
}

const productsRef = collection(db, 'products');

/**
 * Live product list, newest first. Search and status filtering stay client-side
 * over this array — the catalog is small, it mirrors the mockup's behaviour
 * exactly, and it avoids composite indexes.
 *
 * Sorting is deliberately client-side too. `addProduct` writes
 * `serverTimestamp()`, so the optimistic local echo carries `createdAt: null`
 * until the server round-trips; a Firestore `orderBy('createdAt')` would drop
 * that document from the snapshot and the owner would watch the product they
 * just saved fail to appear on Dasbor. Sorting here puts pending writes at the
 * top instead, which is what "I just added this" should look like.
 */
export function subscribeProducts(
  onData: (items: Product[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    productsRef,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, 'id'>),
      }));
      items.sort((a, b) => createdMillis(b) - createdMillis(a));
      onData(items);
    },
    onError,
  );
}

/** Pending server timestamps sort to the top. */
function createdMillis(p: Product): number {
  return p.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
}

export type NewProduct = {
  name: string;
  price: number;
  sku: string;
  status: Status;
  cat: Category;
  imageUrl?: string;
  imageUrls?: string[];
};

export async function addProduct(input: NewProduct) {
  return addDoc(productsRef, {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setProductStatus(id: string, status: Status) {
  return updateDoc(doc(db, 'products', id), {
    status,
    updatedAt: serverTimestamp(),
    // Stamped so Ringkasan can scope revenue to the current month.
    ...(status === 'Terjual' ? { soldAt: serverTimestamp() } : null),
  });
}

/**
 * Removes a product outright. Unlike `setProductStatus(id, 'Arsip')` there is
 * no way back — the caller confirms first.
 *
 * The uploaded photos are not touched here; that is handled best-effort by
 * `deleteProductImages` once this write is acknowledged.
 */
export async function deleteProduct(id: string) {
  return deleteDoc(doc(db, 'products', id));
}

/** Case-insensitive name search, matching the mockup's `onSearch`. */
export function searchProducts(items: Product[], queryText: string): Product[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.name.toLowerCase().includes(q));
}

/** `Semua` matches everything; any other tab matches its status exactly. */
export function filterByTab(items: Product[], tab: string): Product[] {
  if (tab === 'Semua') return items;
  return items.filter((i) => i.status === tab);
}

export function countByStatus(items: Product[], status: Status): number {
  return items.filter((i) => i.status === status).length;
}

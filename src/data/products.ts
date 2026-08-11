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
  imageUrl?: string;
  createdAt?: Timestamp;
  soldAt?: Timestamp;
};

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
 * The uploaded photo is not touched here; that is handled best-effort by
 * `deleteProductImage` once this write is acknowledged.
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

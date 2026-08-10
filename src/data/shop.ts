import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ShopConfig = {
  /** International format, no `+` — used to build wa.me links. */
  whatsappNumber: string;
  shopName: string;
};

/** Matches the mockup's `whatsappNumber` prop default. */
export const DEFAULT_SHOP: ShopConfig = {
  whatsappNumber: '6281234567890',
  shopName: 'Curated by Mami L',
};

const shopRef = doc(db, 'shop', 'config');

export function subscribeShop(
  onData: (config: ShopConfig) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    shopRef,
    (snap) => onData({ ...DEFAULT_SHOP, ...(snap.data() as Partial<ShopConfig> | undefined) }),
    onError,
  );
}

export async function updateShop(patch: Partial<ShopConfig>) {
  return setDoc(shopRef, patch, { merge: true });
}

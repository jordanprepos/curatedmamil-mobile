import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { OrderState } from '../theme/tokens';

export type Order = {
  id: string;
  buyer: string;
  itemName: string;
  price: number;
  state: OrderState;
  /** Buyer's WhatsApp number in international form, e.g. 6281234567890. */
  phone?: string;
  createdAt?: Timestamp;
};

const ordersRef = collection(db, 'orders');

export function subscribeOrders(
  onData: (items: Order[]) => void,
  onError: (e: Error) => void,
) {
  return onSnapshot(
    query(ordersRef, orderBy('createdAt', 'desc')),
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
    },
    onError,
  );
}

export async function setOrderState(id: string, state: OrderState) {
  return updateDoc(doc(db, 'orders', id), { state, updatedAt: serverTimestamp() });
}

/** Drives the badge on the Dasbor header bag icon. */
export function countNewOrders(orders: Order[]): number {
  return orders.filter((o) => o.state === 'Baru').length;
}

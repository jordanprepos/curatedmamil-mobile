import {
  collection,
  deleteField,
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
  /**
   * What `state` was before the order was cancelled, so `Aktifkan lagi` can put
   * it back where it came from rather than guessing at `Baru`.
   *
   * Only set while `state === 'Dibatalkan'`; `restoreOrder` clears it. A
   * cancellation is a real state on the document, not a client-side flag —
   * anything else leaves `state` lying to every other reader, `countNewOrders`
   * included, and the Dasbor badge would keep counting a cancelled order.
   */
  stateBeforeCancel?: OrderState;
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

/**
 * Cancels an order, remembering the state it was in.
 *
 * `currentState` is read from the document rather than assumed: an order can be
 * cancelled from `Baru` or from `Dikirim`, and restoring it must not silently
 * promote or demote it.
 */
export async function cancelOrder(id: string, currentState: OrderState) {
  return updateDoc(doc(db, 'orders', id), {
    state: 'Dibatalkan',
    stateBeforeCancel: currentState,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Undoes a cancellation, returning the order to where it was.
 *
 * Falls back to `Baru` when `stateBeforeCancel` is missing — an order cancelled
 * by hand in the Firebase console won't carry it, and stranding it as
 * permanently cancelled would be worse than putting it back in the queue.
 */
export async function restoreOrder(id: string, previous: OrderState | undefined) {
  return updateDoc(doc(db, 'orders', id), {
    state: previous ?? 'Baru',
    stateBeforeCancel: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/** Drives the badge on the Dasbor header bag icon. */
export function countNewOrders(orders: Order[]): number {
  return orders.filter((o) => o.state === 'Baru').length;
}

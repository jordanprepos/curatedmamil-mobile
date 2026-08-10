import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../lib/auth';
import { subscribeProducts, type Product } from './products';
import { subscribeOrders, type Order } from './orders';
import { subscribeShop, DEFAULT_SHOP, type ShopConfig } from './shop';

type ShopData = {
  products: Product[];
  orders: Order[];
  shop: ShopConfig;
  loading: boolean;
  /** Set when a listener fails — surfaced in Indonesian on the screens. */
  error: string | null;
};

const ShopDataContext = createContext<ShopData | null>(null);

/**
 * Holds the app's three Firestore listeners in one place. Screens read from
 * here instead of subscribing individually, so switching tabs doesn't tear
 * down and re-establish snapshots.
 */
export function ShopDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shop, setShop] = useState<ShopConfig>(DEFAULT_SHOP);
  const [productsReady, setProductsReady] = useState(false);
  const [ordersReady, setOrdersReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Keyed on the signed-in uid, and deliberately so.
   *
   * A Firestore onSnapshot listener that errors is terminated permanently — it
   * does not retry. This layout mounts for a moment before AuthGate redirects a
   * signed-out visitor to /masuk, so subscribing unconditionally attaches the
   * listeners without a token, they die with permission-denied, and the error
   * sticks for the rest of the session even after a successful login.
   *
   * Re-keying on uid tears the listeners down on sign-out and re-establishes
   * them with a fresh token on sign-in.
   */
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setOrders([]);
      setShop(DEFAULT_SHOP);
      setProductsReady(false);
      setOrdersReady(false);
      setError(null);
      return;
    }

    const onError = (e: Error) => {
      const code = (e as { code?: string }).code;
      setError(
        code === 'permission-denied'
          ? 'Tidak punya akses ke data toko.'
          : 'Gagal memuat data. Periksa koneksi Anda.',
      );
    };

    const unsubProducts = subscribeProducts((items) => {
      setProducts(items);
      setProductsReady(true);
      setError(null);
    }, onError);

    const unsubOrders = subscribeOrders((items) => {
      setOrders(items);
      setOrdersReady(true);
    }, onError);

    const unsubShop = subscribeShop(setShop, onError);

    return () => {
      unsubProducts();
      unsubOrders();
      unsubShop();
    };
  }, [user]);

  const value = useMemo<ShopData>(
    () => ({
      products,
      orders,
      shop,
      loading: !productsReady || !ordersReady,
      error,
    }),
    [products, orders, shop, productsReady, ordersReady, error],
  );

  return <ShopDataContext.Provider value={value}>{children}</ShopDataContext.Provider>;
}

export function useShopData(): ShopData {
  const ctx = useContext(ShopDataContext);
  if (!ctx) throw new Error('useShopData must be used inside <ShopDataProvider>');
  return ctx;
}

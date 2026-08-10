import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { ShopDataProvider } from '../../src/data/store';
import { colors } from '../../src/theme/tokens';

/**
 * The mockup renders its tab bar outside every screen conditional, so the bar
 * is visible on all six screens — Detail included. Keeping produk/[id] inside
 * this group (hidden from the bar with href: null) preserves that while still
 * giving Detail a real push/pop.
 */
export default function TabsLayout() {
  return (
    <ShopDataProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bgApp },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="produk" />
        <Tabs.Screen name="tambah" />
        <Tabs.Screen name="pesanan" />
        <Tabs.Screen name="lainnya" />
        <Tabs.Screen name="produk/[id]" options={{ href: null }} />
      </Tabs>
    </ShopDataProvider>
  );
}

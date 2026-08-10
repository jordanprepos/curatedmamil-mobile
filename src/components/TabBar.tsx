import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Txt } from '../theme/text';
import { colors } from '../theme/tokens';

/** How far the centre "+" circle rises above the bar, per the mockup. */
const OVERHANG = 22;
const CIRCLE = 46;

/**
 * Tabs in mockup order. The centre entry is a nav item, not a floating action
 * button — it navigates to Tambah like any other tab, it just renders as a
 * raised circle.
 */
const TABS: readonly { name: string; label: string; center?: boolean }[] = [
  { name: 'index', label: 'Dasbor' },
  { name: 'produk', label: 'Produk' },
  { name: 'tambah', label: 'Tambah', center: true },
  { name: 'pesanan', label: 'Pesanan' },
  { name: 'lainnya', label: 'Lainnya' },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name ?? 'index';

  // Detail is a child of the Produk section, so it keeps that tab lit. The
  // mockup lit nothing on Detail only because it had no nav stack to model.
  const activeTab = currentName.startsWith('produk/') ? 'produk' : currentName;

  function onPress(routeName: string) {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name as never);
    }
  }

  return (
    // box-none keeps the transparent strip above the bar (where the circle
    // overhangs) from swallowing touches meant for the screen behind it.
    <View pointerEvents="box-none" style={{ paddingTop: OVERHANG }}>
      {/* The bar surface itself, inset below the overhang strip. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: OVERHANG,
          bottom: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.name;
          const color = active ? colors.primary : colors.faint;

          return (
            <Pressable
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={() => onPress(tab.name)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                ...(tab.center ? null : { paddingVertical: 6 }),
              }}
            >
              {tab.center ? (
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: CIRCLE,
                      height: CIRCLE,
                      marginTop: -OVERHANG,
                      borderRadius: CIRCLE / 2,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt
                      size={24}
                      weight={300}
                      color={colors.onPrimary}
                      style={{ lineHeight: 28 }}
                    >
                      +
                    </Txt>
                  </View>
                  <Txt size={14} color={color}>
                    {tab.label}
                  </Txt>
                </View>
              ) : (
                <Txt size={14} color={color}>
                  {tab.label}
                </Txt>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

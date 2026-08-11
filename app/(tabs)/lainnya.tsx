import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { Field } from '../../src/components/Field';
import { PillButton } from '../../src/components/PillButton';
import { useShopData } from '../../src/data/store';
import { updateShop } from '../../src/data/shop';
import { useAuth } from '../../src/lib/auth';
import { dayAndMonthId, rupiah, startOfMonth } from '../../src/lib/format';
import { withWriteTimeout, writeErrorMessage } from '../../src/lib/write';
import { Display, Txt } from '../../src/theme/text';
import { colors, radius, space, statDotColors } from '../../src/theme/tokens';

type EditTarget = 'shopName' | 'whatsappNumber' | null;

export default function Ringkasan() {
  const insets = useSafeAreaInsets();
  const { products, shop, loading } = useShopData();
  const { keluar } = useAuth();

  const [editing, setEditing] = useState<EditTarget>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const by = (s: string) => products.filter((p) => p.status === s).length;
    return [
      { value: products.length, label: 'Total Produk', ...statDotColors.total },
      { value: by('Aktif'), label: 'Aktif', ...statDotColors.aktif },
      { value: by('Terjual'), label: 'Terjual', ...statDotColors.terjual },
      { value: by('Arsip'), label: 'Arsip', ...statDotColors.arsip },
    ];
  }, [products]);

  // "Bulan ini" revenue: sold products stamped within the current month.
  const monthStart = startOfMonth();
  const soldThisMonth = products.filter(
    (p) => p.status === 'Terjual' && (p.soldAt?.toMillis() ?? 0) >= monthStart.getTime(),
  );
  const revenue = soldThisMonth.reduce((sum, p) => sum + p.price, 0);

  function openEdit(target: Exclude<EditTarget, null>) {
    setDraft(target === 'shopName' ? shop.shopName : shop.whatsappNumber);
    setError(null);
    setEditing(target);
  }

  async function saveEdit() {
    if (!editing) return;
    const value = draft.trim();
    if (!value) return setError('Tidak boleh kosong.');
    if (editing === 'whatsappNumber' && !/^\d{8,15}$/.test(value)) {
      return setError('Gunakan format internasional tanpa +, mis. 6281234567890.');
    }

    setSaving(true);
    try {
      await withWriteTimeout(updateShop({ [editing]: value }));
      setEditing(null);
    } catch (e) {
      setError(writeErrorMessage(e, 'Gagal menyimpan. Coba lagi.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgApp }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.screenX }}>
        <Txt size={14} tracking={0.28} color={colors.faint}>
          RINGKASAN
        </Txt>
        <Txt size={26} weight={600} style={{ marginTop: 6 }}>
          Bulan ini
        </Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 12,
          paddingHorizontal: space.screenX,
        }}
      >
        <View style={{ gap: 10 }}>
          {stats.map((s) => (
            <Card
              key={s.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.tile,
                  backgroundColor: s.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: s.dot,
                  }}
                />
              </View>
              <View>
                <Txt size={22} weight={600} lineHeight={22}>
                  {loading ? '—' : s.value}
                </Txt>
                <Txt size={12.5} weight={300} color={colors.muted} style={{ marginTop: 4 }}>
                  {s.label}
                </Txt>
              </View>
            </Card>
          ))}
        </View>

        <View
          style={{
            marginTop: 16,
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: radius.card,
            backgroundColor: colors.chip,
          }}
        >
          <Txt size={11} tracking={0.2} color={colors.faint}>
            PENDAPATAN
          </Txt>
          <Display size={28} weight={600} style={{ marginTop: 8 }}>
            {rupiah(revenue)}
          </Display>
          <Txt size={12.5} weight={300} color={colors.muted} style={{ marginTop: 6 }}>
            {soldThisMonth.length} produk terjual sejak {dayAndMonthId(monthStart)}
          </Txt>
        </View>

        <Card style={{ marginTop: 16, overflow: 'hidden' }}>
          <SettingRow
            label="Profil toko"
            value={shop.shopName}
            onPress={() => openEdit('shopName')}
          />
          <SettingRow
            label="Nomor WhatsApp"
            value={shop.whatsappNumber}
            onPress={() => openEdit('whatsappNumber')}
          />
          <SettingRow label="Keluar" onPress={keluar} isLast danger />
        </Card>
      </ScrollView>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable
          onPress={() => setEditing(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(43,35,32,0.35)',
            justifyContent: 'center',
            paddingHorizontal: space.screenX,
          }}
        >
          {/* Stops taps inside the sheet from dismissing it. */}
          <Pressable
            onPress={() => {}}
            style={{
              borderRadius: radius.card,
              backgroundColor: colors.bgApp,
              padding: 20,
            }}
          >
            <Txt size={15} weight={600}>
              {editing === 'shopName' ? 'Profil toko' : 'Nomor WhatsApp'}
            </Txt>
            <Field
              label={editing === 'shopName' ? 'NAMA TOKO' : 'NOMOR WHATSAPP'}
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                setError(null);
              }}
              placeholder={editing === 'shopName' ? 'Curated by Mami L' : '6281234567890'}
              keyboardType={editing === 'shopName' ? 'default' : 'number-pad'}
              autoCapitalize={editing === 'shopName' ? 'words' : 'none'}
              containerStyle={{ marginTop: 16 }}
            />
            {error ? (
              <Txt size={12.5} color={colors.danger} style={{ marginTop: 10 }}>
                {error}
              </Txt>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <PillButton
                label="Batal"
                variant="outline"
                onPress={() => setEditing(null)}
                size={13}
                paddingVertical={13}
                style={{ flex: 1 }}
              />
              <PillButton
                label="Simpan"
                onPress={saveEdit}
                loading={saving}
                size={13}
                paddingVertical={13}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SettingRow({
  label,
  value,
  onPress,
  isLast,
  danger,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 15,
        paddingHorizontal: 18,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.divider,
        backgroundColor: pressed ? colors.bgApp : 'transparent',
      })}
    >
      <Txt size={13.5} color={danger ? colors.primary : colors.ink}>
        {label}
      </Txt>
      {value ? (
        <Txt size={12.5} weight={300} color={colors.faint} numberOfLines={1}>
          {value}
        </Txt>
      ) : null}
    </Pressable>
  );
}

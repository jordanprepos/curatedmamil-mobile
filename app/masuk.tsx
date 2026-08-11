import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '../src/components/Field';
import { PillButton } from '../src/components/PillButton';
import { authErrorMessage, useAuth } from '../src/lib/auth';
import { Display, Txt } from '../src/theme/text';
import { colors, space } from '../src/theme/tokens';

/**
 * Owner sign-in. Not part of the original mockup — the prototype had no auth —
 * but built in its visual language: Playfair wordmark, warm neutrals, and the
 * same #A07D77 pill as every other primary action.
 */
export default function Masuk() {
  const insets = useSafeAreaInsets();
  const { masuk } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await masuk(email, password);
      // The redirect is handled by AuthGate in app/_layout.tsx.
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgApp }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: space.screenX + 8,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Txt size={8} tracking={0.3} color={colors.faint}>
            CURATED 2026
          </Txt>
          <Display size={34} weight={500} tracking={0.04} style={{ marginTop: 4 }}>
            Mami L
          </Display>
          <Txt size={13} weight={300} color={colors.muted} style={{ marginTop: 10 }}>
            Masuk untuk mengelola toko Anda
          </Txt>
        </View>

        <Field
          label="EMAIL"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          placeholder="nama@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          containerStyle={{ marginBottom: 16 }}
        />

        <Field
          label="KATA SANDI"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          placeholder="••••••••"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />

        {error ? (
          <Txt size={12.5} weight={400} color={colors.danger} style={{ marginTop: 14 }}>
            {error}
          </Txt>
        ) : null}

        <PillButton
          label="Masuk"
          block
          onPress={onSubmit}
          loading={busy}
          disabled={!canSubmit}
          paddingVertical={16}
          size={13.5}
          style={{ marginTop: 26 }}
        />

        <Txt
          size={11.5}
          weight={300}
          color={colors.faint}
          align="center"
          style={{ marginTop: 20 }}
        >
          Hanya pemilik toko yang dapat masuk.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

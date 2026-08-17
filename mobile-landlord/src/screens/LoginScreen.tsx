import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily } from '../theme';
import { Logo, Button, BrandFooter } from '../ui';

export default function LoginScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signIn } = useAuth();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const request = async () => {
    setBusy(true);
    // setCode('') matters: only the newest challenge is checked server-side, so a
    // stale value left in the field would submit a dead code and burn an attempt.
    try { await api.requestOtp(destination.trim()); setCode(''); setStage('verify'); Alert.alert('Code sent', `We sent a 6-digit code to ${destination.trim()}.`); }
    catch (e: any) { Alert.alert('Could not send code', e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { const { accessToken } = await api.verifyOtp(destination.trim(), code.trim(), remember); await signIn(accessToken); }
    catch (e: any) { Alert.alert('Sign in failed', e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'transparent' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.card}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Logo size={54} showName={false} />
          </View>
          <Text style={s.title}>{t.logo.text}</Text>
          <Text style={s.sub}>{t.tagline ?? 'Landlord portal'}</Text>

          {stage === 'request' ? (
            <>
              <Text style={s.label}>Email or mobile number</Text>
              <TextInput style={s.input} value={destination} onChangeText={setDestination} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com or +27…" placeholderTextColor={t.colors.muted} />
              <Text style={s.hint}>We’ll send a code to your email or by SMS. Use +27… for phone numbers.</Text>
              <Button label="Send code" onPress={request} busy={busy} style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={s.label}>6-digit code</Text>
              <TextInput style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="------" placeholderTextColor={t.colors.muted} />
              <View style={s.rememberRow}>
                <Switch value={remember} onValueChange={setRemember} trackColor={{ true: t.colors.brand }} />
                <Text style={s.rememberLabel}>Remember this device (skip the code next time)</Text>
              </View>
              <Button label="Verify & sign in" onPress={verify} busy={busy} style={{ marginTop: 8 }} />
              <Text style={s.link} onPress={() => setStage('request')}>Use a different address</Text>
            </>
          )}
        </View>
        <BrandFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flexGrow: 1, justifyContent: 'center', padding: 22 },
    card: {
      backgroundColor: t.colors.card, borderRadius: 18, borderWidth: 1, borderColor: t.colors.line, padding: 24,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2,
    },
    title: { fontSize: 24, fontWeight: '700', color: t.colors.ink, textAlign: 'center', fontFamily: fontFamily(t, true) },
    sub: { fontSize: 14, color: t.colors.muted, marginBottom: 24, textAlign: 'center', fontFamily: fontFamily(t) },
    label: { fontSize: 13, color: t.colors.muted, marginBottom: 6, fontFamily: fontFamily(t) },
    hint: { fontSize: 12, color: t.colors.muted, marginTop: -2, marginBottom: 4, fontFamily: fontFamily(t) },
    input: {
      borderWidth: 1, borderColor: t.colors.line, borderRadius: 10, padding: 14, fontSize: 16,
      marginBottom: 8, color: t.colors.ink, backgroundColor: 'transparent', fontFamily: fontFamily(t),
    },
    link: { color: t.colors.brand, fontSize: 13, textAlign: 'center', marginTop: 16, fontFamily: fontFamily(t) },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 4 },
    rememberLabel: { flex: 1, fontSize: 13, color: t.colors.ink, fontFamily: fontFamily(t) },
  });
}

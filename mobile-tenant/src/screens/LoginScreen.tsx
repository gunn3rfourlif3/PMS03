import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
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
  const [destination, setDestination] = useState('thabo@demo.test');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    try { await api.requestOtp(destination.trim()); setStage('verify'); Alert.alert('Code sent', 'In dev, the OTP prints to the API server console.'); }
    catch (e: any) { Alert.alert('Could not send code', e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { const { accessToken } = await api.verifyOtp(destination.trim(), code.trim()); await signIn(accessToken); }
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
          <Text style={s.sub}>{t.tagline ?? 'Sign in to manage your rental'}</Text>

          {stage === 'request' ? (
            <>
              <Text style={s.label}>Email or phone</Text>
              <TextInput style={s.input} value={destination} onChangeText={setDestination} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={t.colors.muted} />
              <Button label="Send code" onPress={request} busy={busy} style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={s.label}>6-digit code</Text>
              <TextInput style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" placeholderTextColor={t.colors.muted} />
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
    input: {
      borderWidth: 1, borderColor: t.colors.line, borderRadius: 10, padding: 14, fontSize: 16,
      marginBottom: 8, color: t.colors.ink, backgroundColor: 'transparent', fontFamily: fontFamily(t),
    },
    link: { color: t.colors.brand, fontSize: 13, textAlign: 'center', marginTop: 16, fontFamily: fontFamily(t) },
  });
}

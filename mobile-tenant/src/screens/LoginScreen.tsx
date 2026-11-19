import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily, ctaGradient } from '../theme';
import { Logo, Button, BrandFooter } from '../ui';
import { useLocale } from '../i18n';

export default function LoginScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signIn } = useAuth();
  const { t: tr } = useLocale();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const request = async () => {
    setBusy(true);
    // setCode('') matters: only the newest challenge is checked server-side, so a
    // stale value left in the field would submit a dead code and burn an attempt.
    try { await api.requestOtp(destination.trim()); setCode(''); setStage('verify'); Alert.alert(tr('tenant.login.codeSentTitle'), tr('tenant.login.codeSentBody', { destination: destination.trim() })); }
    catch (e: any) { Alert.alert(tr('tenant.login.sendFailed'), e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { const { accessToken } = await api.verifyOtp(destination.trim(), code.trim(), remember); await signIn(accessToken); }
    catch (e: any) { Alert.alert(tr('tenant.login.signInFailed'), e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'transparent' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.wrap}>
        <LinearGradient colors={ctaGradient(t)} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.card}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Logo size={54} showName={false} />
          </View>
          <Text style={s.title}>{t.logo.text}</Text>
          <Text style={s.sub}>{t.tagline ?? tr('tenant.login.taglineFallback')}</Text>

          {stage === 'request' ? (
            <>
              <Text style={s.label}>{tr('tenant.login.destinationLabel')}</Text>
              <TextInput style={s.input} value={destination} onChangeText={setDestination} autoCapitalize="none" keyboardType="email-address" placeholder={tr('tenant.login.destinationPlaceholder')} placeholderTextColor={t.colors.muted} />
              <Text style={s.hint}>{tr('tenant.login.destinationHint')}</Text>
              <Button label={tr('tenant.login.sendCode')} onPress={request} busy={busy} onDark style={{ marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text style={s.label}>{tr('tenant.login.codeLabel')}</Text>
              <TextInput style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder={tr('tenant.login.codePlaceholder')} placeholderTextColor={t.colors.muted} />
              <View style={s.rememberRow}>
                <Switch value={remember} onValueChange={setRemember} trackColor={{ true: t.colors.brand }} />
                <Text style={s.rememberLabel}>{tr('tenant.login.remember')}</Text>
              </View>
              <Button label={tr('tenant.login.verify')} onPress={verify} busy={busy} onDark style={{ marginTop: 8 }} />
              <Text style={s.link} onPress={() => setStage('request')}>{tr('tenant.login.useDifferent')}</Text>
            </>
          )}
        </LinearGradient>
        <BrandFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flexGrow: 1, justifyContent: 'center', padding: 22 },
    card: {
      borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 26,
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 6,
    },
    title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6, color: '#fff', textAlign: 'center', fontFamily: fontFamily(t, true) },
    sub: { fontSize: 14, color: 'rgba(226,238,246,0.70)', marginBottom: 24, textAlign: 'center', fontFamily: fontFamily(t) },
    label: { fontSize: 12.5, color: 'rgba(226,238,246,0.70)', letterSpacing: 0.3, marginBottom: 6, fontFamily: fontFamily(t) },
    hint: { fontSize: 12, color: 'rgba(226,238,246,0.55)', marginTop: -2, marginBottom: 4, fontFamily: fontFamily(t) },
    input: {
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: 12, padding: 14, fontSize: 16,
      marginBottom: 8, color: '#fff', backgroundColor: 'rgba(255,255,255,0.07)', fontFamily: fontFamily(t),
    },
    link: { color: '#8CBAD6', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16, fontFamily: fontFamily(t) },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 4 },
    rememberLabel: { flex: 1, fontSize: 13, color: 'rgba(226,238,246,0.82)', fontFamily: fontFamily(t) },
  });
}

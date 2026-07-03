import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api';
import { BRAND } from '../config';
import { useAuth } from '../auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('owner@demo.test');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    try { await api.requestOtp(destination.trim()); setStage('verify'); Alert.alert('Code sent', 'In dev the OTP prints to the API server console.'); }
    catch (e: any) { Alert.alert('Could not send code', e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { const { accessToken } = await api.verifyOtp(destination.trim(), code.trim()); await signIn(accessToken); }
    catch (e: any) { Alert.alert('Sign in failed', e.message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.badge}><Text style={s.badgeText}>{BRAND.name[0]}</Text></View>
      <Text style={s.title}>{BRAND.name}</Text>
      <Text style={s.sub}>Landlord portal</Text>
      {stage === 'request' ? (
        <>
          <Text style={s.label}>Email or phone</Text>
          <TextInput style={s.input} value={destination} onChangeText={setDestination} autoCapitalize="none" />
          <TouchableOpacity style={s.btn} onPress={request} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send code</Text>}</TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={s.label}>6-digit code</Text>
          <TextInput style={s.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <TouchableOpacity style={s.btn} onPress={verify} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Verify and sign in</Text>}</TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  badge: { width: 56, height: 56, borderRadius: 16, backgroundColor: BRAND.color, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  badgeText: { color: '#fff', fontSize: 26, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '500', color: '#111' },
  sub: { fontSize: 15, color: '#666', marginBottom: 28 },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16 },
  btn: { backgroundColor: BRAND.color, borderRadius: 10, padding: 15, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});

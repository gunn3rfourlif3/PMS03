import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../api';
import { BRAND } from '../config';
import { useAuth } from '../auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [destination, setDestination] = useState('thabo@demo.test');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);
    try {
      await api.requestOtp(destination.trim());
      setStage('verify');
      Alert.alert('Code sent', 'In dev, the OTP prints to the API server console.');
    } catch (e: any) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const { accessToken } = await api.verifyOtp(destination.trim(), code.trim());
      await signIn(accessToken);
    } catch (e: any) {
      Alert.alert('Sign in failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brandBadge}><Text style={styles.brandLetter}>{BRAND.name[0]}</Text></View>
      <Text style={styles.title}>{BRAND.name}</Text>
      <Text style={styles.subtitle}>Sign in to manage your rental</Text>

      {stage === 'request' ? (
        <>
          <Text style={styles.label}>Email or phone</Text>
          <TextInput
            style={styles.input}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <TouchableOpacity style={styles.button} onPress={request} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>6-digit code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
          />
          <TouchableOpacity style={styles.button} onPress={verify} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify and sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStage('request')}>
            <Text style={styles.link}>Use a different address</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  brandBadge: { width: 56, height: 56, borderRadius: 16, backgroundColor: BRAND.color, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brandLetter: { color: '#fff', fontSize: 26, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '500', color: '#111' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 28 },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 16 },
  button: { backgroundColor: BRAND.color, borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  link: { color: BRAND.color, textAlign: 'center', marginTop: 16, fontSize: 14 },
});

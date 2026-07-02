import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { BRAND } from '../config';
import { useAuth } from '../auth-context';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');

export default function DashboardScreen({ navigation }: any) {
  const { signOut } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      setInvoices(await api.myInvoices());
    } catch (e: any) {
      Alert.alert('Could not load', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const due = invoices.find((i) => i.status !== 'paid' && i.status !== 'void');

  const pay = async () => {
    if (!due) return;
    setPaying(true);
    try {
      const res = await api.initiatePayment(due.id, 'eft');
      if (res.redirectUrl) await Linking.openURL(res.redirectUrl);
      else Alert.alert('Payment started', 'Reference: ' + res.paymentId);
    } catch (e: any) {
      Alert.alert('Payment failed', e.message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={BRAND.color} /></View>;
  }

  return (
    <ScrollView
      style={styles.wrap}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={BRAND.color} />}
    >
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>{due ? `${due.period} rent` : 'Rent'}</Text>
          {due ? (
            <Text style={styles.pillDue}>Due {due.dueDate}</Text>
          ) : (
            <Text style={styles.pillPaid}>All paid</Text>
          )}
        </View>
        <Text style={styles.amount}>{due ? money(due.total) : money(0)}</Text>
        <Text style={styles.muted}>{due ? 'Includes VAT' : 'Nothing outstanding'}</Text>
        {due && (
          <TouchableOpacity style={styles.payBtn} onPress={pay} disabled={paying}>
            {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Pay rent</Text>}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actions}>
        <Action icon="R" label="Pay" onPress={pay} disabled={!due} />
        <Action icon="L" label="Lease" onPress={() => navigation.navigate('Lease')} />
        <Action icon="?" label="Sign out" onPress={signOut} />
      </View>

      <Text style={styles.sectionTitle}>Invoices</Text>
      {invoices.length === 0 && <Text style={styles.muted}>No invoices yet.</Text>}
      {invoices.map((i) => (
        <View key={i.id} style={styles.invoiceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.invoicePeriod}>{i.period}</Text>
            <Text style={styles.muted}>{money(i.total)}</Text>
          </View>
          <Text style={[styles.status, i.status === 'paid' ? styles.statusPaid : styles.statusOpen]}>
            {i.status}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Action({ icon, label, onPress, disabled }: any) {
  return (
    <TouchableOpacity style={[styles.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <View style={styles.actionIcon}><Text style={styles.actionIconText}>{icon}</Text></View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f6f4', padding: 16 },
  center: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: '#777', fontSize: 13 },
  amount: { fontSize: 30, fontWeight: '500', color: '#111', marginVertical: 4 },
  pillDue: { backgroundColor: '#FAECE7', color: '#993C1D', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
  pillPaid: { backgroundColor: '#E1F5EE', color: '#0F6E56', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
  payBtn: { backgroundColor: BRAND.color, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  payText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  action: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  actionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: BRAND.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionIconText: { color: BRAND.color, fontWeight: '500', fontSize: 16 },
  actionLabel: { fontSize: 12, color: '#333' },
  sectionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 8, color: '#111' },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  invoicePeriod: { fontSize: 15, color: '#111' },
  status: { fontSize: 12, textTransform: 'capitalize' },
  statusPaid: { color: '#0F6E56' },
  statusOpen: { color: '#993C1D' },
});

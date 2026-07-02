import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../api';
import { BRAND } from '../config';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');

export default function LeaseScreen() {
  const [lease, setLease] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myLease().then(setLease).catch(() => setLease(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={BRAND.color} /></View>;
  if (!lease) return <View style={styles.center}><Text style={styles.muted}>No active lease found.</Text></View>;

  const rows: [string, string][] = [
    ['Status', lease.status],
    ['Type', lease.type],
    ['Monthly rent', money(lease.rentAmount)],
    ['Billing cycle', lease.billingCycle],
    ['Start date', lease.startDate],
    ['End date', lease.endDate || '—'],
  ];

  return (
    <ScrollView style={styles.wrap}>
      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f6f4', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: '#777' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  k: { color: '#777', fontSize: 14 },
  v: { color: '#111', fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
});

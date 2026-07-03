import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { BRAND } from '../config';
import { useAuth } from '../auth-context';

const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');
const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function DashboardScreen() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rentRoll, setRentRoll] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any>(null);
  const [collection, setCollection] = useState<any>(null);
  const [period, setPeriod] = useState(thisPeriod());

  const load = useCallback(async () => {
    try {
      const [rr, ar, col] = await Promise.all([api.rentRoll(), api.arrears(), api.collection(period)]);
      setRentRoll(rr); setArrears(ar); setCollection(col);
    } catch { /* ignore in dev */ } finally { setLoading(false); }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={BRAND.color} /></View>;

  return (
    <ScrollView style={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={BRAND.color} />}>
      <View style={s.grid}>
        <Metric label="Active leases" value={String(rentRoll.length)} />
        <Metric label={`Collected · ${period}`} value={collection ? money(collection.collected) : '—'} />
        <Metric label="Collection rate" value={collection ? `${collection.collectionRate}%` : '—'} />
        <Metric label="Arrears" value={arrears ? money(arrears.total) : '—'} />
      </View>

      <View style={s.periodRow}>
        <Text style={s.muted}>Period</Text>
        <TextInput style={s.periodInput} value={period} onChangeText={setPeriod} onSubmitEditing={load} />
        <TouchableOpacity style={s.refresh} onPress={load}><Text style={{ color: BRAND.color }}>Refresh</Text></TouchableOpacity>
      </View>

      <Text style={s.section}>Portfolio</Text>
      {rentRoll.map((r) => (
        <View key={r.lease_id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.unit}>{r.unit}</Text>
            <Text style={s.muted}>{r.status}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.unit}>{money(r.rent_amount)}</Text>
            {Number(r.outstanding) > 0 && <Text style={s.due}>{money(r.outstanding)} due</Text>}
          </View>
        </View>
      ))}
      {rentRoll.length === 0 && <Text style={s.muted}>No active leases.</Text>}

      <TouchableOpacity style={s.signout} onPress={signOut}><Text style={{ color: BRAND.color }}>Sign out</Text></TouchableOpacity>
    </ScrollView>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return <View style={s.metric}><Text style={s.muted}>{label}</Text><Text style={s.value}>{value}</Text></View>;
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f6f4', padding: 16 },
  center: { flex: 1, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  metric: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  muted: { color: '#777', fontSize: 13 },
  value: { fontSize: 22, fontWeight: '600', marginTop: 4 },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  periodInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, width: 110, backgroundColor: '#fff' },
  refresh: { padding: 8 },
  section: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  unit: { fontSize: 15, color: '#111' },
  due: { fontSize: 12, color: '#993C1D' },
  signout: { alignItems: 'center', padding: 18 },
});

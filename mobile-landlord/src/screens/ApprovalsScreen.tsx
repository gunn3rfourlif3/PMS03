import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { BRAND } from '../config';

const nextMonthFirst = () => {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
};

export default function ApprovalsScreen() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setApps(await api.applications()); } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={BRAND.color} /></View>;

  return (
    <ScrollView style={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={BRAND.color} />}>
      {apps.map((a) => (
        <View key={a.id} style={s.card}>
          <Text style={s.name}>{a.applicantName}</Text>
          <Text style={s.muted}>{a.applicantEmail}</Text>
          <View style={s.metaRow}>
            <Text style={s.badge}>{a.status}</Text>
            {a.screeningResult?.recommendation && <Text style={s.rec}>rec: {a.screeningResult.recommendation}</Text>}
          </View>
          <View style={s.actions}>
            {a.status === 'submitted' && (
              <TouchableOpacity style={s.btnSecondary} onPress={() => act(() => api.screen(a.id))}><Text style={s.btnSecondaryText}>Screen</Text></TouchableOpacity>
            )}
            {a.status === 'screening' && (
              <>
                <TouchableOpacity style={s.btn} onPress={() => act(() => api.approve(a.id, nextMonthFirst()))}><Text style={s.btnText}>Approve</Text></TouchableOpacity>
                <TouchableOpacity style={s.btnSecondary} onPress={() => act(() => api.reject(a.id))}><Text style={s.btnSecondaryText}>Reject</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ))}
      {apps.length === 0 && <Text style={[s.muted, { padding: 16 }]}>No applications.</Text>}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f6f4', padding: 16 },
  center: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  muted: { color: '#777', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  badge: { backgroundColor: BRAND.tint, color: BRAND.color, fontSize: 12, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20, overflow: 'hidden' },
  rec: { fontSize: 12, color: '#555' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { backgroundColor: BRAND.color, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '500' },
  btnSecondary: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#fff' },
  btnSecondaryText: { color: '#111' },
});

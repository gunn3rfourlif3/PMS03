import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, BrandFooter, money } from '../ui';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function DashboardScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
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

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Portfolio overview</Text>

      <View style={s.grid}>
        <Metric t={t} label="Active leases" value={String(rentRoll.length)} />
        <Metric t={t} label={`Collected - ${period}`} value={collection ? money(collection.collected) : '-'} />
        <Metric t={t} label="Collection rate" value={collection ? `${collection.collectionRate}%` : '-'} accent />
        <Metric t={t} label="Outstanding" value={arrears ? money(arrears.total) : '-'} tone={arrears && arrears.arrears > 0 ? 'danger' : undefined} />
      </View>

      <View style={s.periodRow}>
        <Text style={s.muted}>Period</Text>
        <TextInput style={s.periodInput} value={period} onChangeText={setPeriod} onSubmitEditing={load} />
        <TouchableOpacity style={s.refresh} onPress={load}><Text style={{ color: t.colors.brand, fontWeight: '600', fontFamily: fontFamily(t) }}>Refresh</Text></TouchableOpacity>
      </View>

      <Text style={s.section}>Properties</Text>
      {rentRoll.map((r) => (
        <Card key={r.lease_id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.unit}>{r.unit}</Text>
              <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Pill label={r.status} tone={r.status === 'active' ? 'success' : 'muted'} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.rent}>{money(r.rent_amount)}<Text style={s.perMonth}> /mo</Text></Text>
              {Number(r.outstanding) > 0 && <Text style={s.due}>{money(r.outstanding)} due</Text>}
            </View>
          </View>
        </Card>
      ))}
      {rentRoll.length === 0 && <Card><Text style={s.muted}>No active leases yet.</Text></Card>}

      <TouchableOpacity style={s.signout} onPress={signOut}><Text style={{ color: t.colors.muted, fontFamily: fontFamily(t) }}>Sign out</Text></TouchableOpacity>
      <BrandFooter />
    </ScrollView>
  );
}

function Metric({ t, label, value, accent, tone }: { t: Branding; label: string; value: string; accent?: boolean; tone?: 'danger' }) {
  const valueColor = tone === 'danger' ? t.colors.danger : accent ? t.colors.brand : t.colors.ink;
  return (
    <View style={[metricCard(t), accent && { borderColor: t.colors.brand, borderWidth: 1.5 }]}>
      <Text style={{ color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) }}>{label}</Text>
      <Text style={{ fontSize: 23, fontWeight: '700', marginTop: 6, color: valueColor, fontFamily: fontFamily(t, true) }}>{value}</Text>
    </View>
  );
}

function metricCard(t: Branding) {
  return {
    width: '47%' as const, backgroundColor: t.colors.card, borderRadius: 14, borderWidth: 1, borderColor: t.colors.line, padding: 15,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  };
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.colors.bg },
    center: { flex: 1, justifyContent: 'center', backgroundColor: t.colors.bg },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
    periodInput: { borderWidth: 1, borderColor: t.colors.line, borderRadius: 8, padding: 9, width: 110, backgroundColor: t.colors.card, color: t.colors.ink, fontFamily: fontFamily(t) },
    refresh: { padding: 8 },
    section: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    unit: { fontSize: 16, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
    rent: { fontSize: 16, color: t.colors.ink, fontWeight: '700', fontFamily: fontFamily(t, true) },
    perMonth: { fontSize: 12, color: t.colors.muted, fontWeight: '400' },
    due: { fontSize: 12, color: t.colors.danger, marginTop: 4, fontWeight: '600', fontFamily: fontFamily(t) },
    signout: { alignItems: 'center', padding: 16 },
  });
}

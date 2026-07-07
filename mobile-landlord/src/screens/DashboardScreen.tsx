import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter, money, hexToRgba } from '../ui';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function DashboardScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [loading, setLoading] = useState(true);
  const [rentRoll, setRentRoll] = useState<any[]>([]);
  const [arrears, setArrears] = useState<any>(null);
  const [collection, setCollection] = useState<any>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [period, setPeriod] = useState(thisPeriod());

  const load = useCallback(async () => {
    try {
      const [rr, ar, col, tk] = await Promise.all([
        api.rentRoll(), api.arrears(), api.collection(period), api.tickets().catch(() => []),
      ]);
      setRentRoll(rr); setArrears(ar); setCollection(col);
      setOpenTickets(Array.isArray(tk) ? tk.filter((x: any) => x.status === 'open' || x.status === 'assigned').length : 0);
    } catch { /* ignore in dev */ } finally { setLoading(false); }
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  const rate = collection ? Number(collection.collectionRate) : 0;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Pocket analytics</Text>

      <View style={s.grid}>
        <Metric t={t} label="Active leases" value={String(rentRoll.length)} />
        <Metric t={t} label={`Collected · ${period}`} value={collection ? money(collection.collected) : '-'} />
        <Metric t={t} label="Outstanding" value={arrears ? money(arrears.total) : '-'} tone={arrears && arrears.arrears > 0 ? 'danger' : undefined} />
        <Metric t={t} label="Open tickets" value={openTickets == null ? '-' : String(openTickets)} accent />
      </View>

      <Card style={{ marginTop: 4, marginBottom: 16 }}>
        <View style={s.rowBetween}>
          <Text style={s.muted}>Collection rate</Text>
          <Text style={s.ratePct}>{rate}%</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${Math.max(0, Math.min(100, rate))}%` }]} />
        </View>
      </Card>

      <View style={s.periodRow}>
        <Text style={s.muted}>Period</Text>
        <TextInput style={s.periodInput} value={period} onChangeText={setPeriod} onSubmitEditing={load} />
        <Button label="Refresh" variant="secondary" icon="refresh" onPress={load} style={{ paddingVertical: 9, paddingHorizontal: 14 }} />
      </View>

      <Text style={s.section}>Portfolio</Text>
      {rentRoll.map((r) => {
        const active = r.status === 'active';
        return (
          <Card key={r.lease_id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.dot, { backgroundColor: active ? t.colors.success : t.colors.muted }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.unit}>{r.unit}</Text>
                <Text style={s.sub}>{active ? 'Occupied' : r.status}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rent}>{money(r.rent_amount)}<Text style={s.perMonth}> /mo</Text></Text>
                {Number(r.outstanding) > 0 && <Text style={s.due}>{money(r.outstanding)} due</Text>}
              </View>
            </View>
          </Card>
        );
      })}
      {rentRoll.length === 0 && <Card><Text style={s.muted}>No active leases yet.</Text></Card>}

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
    width: '47%' as const, backgroundColor: hexToRgba(t.colors.card, 0.55), borderRadius: 14, borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), padding: 15,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  };
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    ratePct: { fontSize: 15, fontWeight: '700', color: t.colors.brand, fontFamily: fontFamily(t, true) },
    track: { height: 8, borderRadius: 6, backgroundColor: t.colors.tint, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 6, backgroundColor: t.colors.brand },
    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    periodInput: { borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), borderRadius: 8, padding: 9, width: 110, backgroundColor: hexToRgba(t.colors.card, 0.5), color: t.colors.ink, fontFamily: fontFamily(t) },
    refresh: { padding: 8 },
    section: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    unit: { fontSize: 16, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
    sub: { fontSize: 12, color: t.colors.muted, marginTop: 2, fontFamily: fontFamily(t) },
    rent: { fontSize: 16, color: t.colors.ink, fontWeight: '700', fontFamily: fontFamily(t, true) },
    perMonth: { fontSize: 12, color: t.colors.muted, fontWeight: '400' },
    due: { fontSize: 12, color: t.colors.danger, marginTop: 4, fontWeight: '600', fontFamily: fontFamily(t) },
    signout: { alignItems: 'center', padding: 16 },
  });
}

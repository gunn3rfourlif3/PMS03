import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, money } from '../ui';

export default function DocsScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [lease, setLease] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myLease().then(setLease).catch(() => setLease(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
      <Text style={s.heading}>Documents</Text>
      {!lease ? (
        <Card><Text style={s.muted}>No active lease found.</Text></Card>
      ) : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={s.docIcon}><Ionicons name="document-text-outline" size={22} color={t.colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>Lease agreement</Text>
              <Text style={s.muted}>{lease.type} · {lease.status}</Text>
            </View>
          </Card>
          <Card style={{ padding: 4 }}>
            {rows(lease, money).map(([k, v], idx, arr) => (
              <View key={k} style={[s.row, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.k}>{k}</Text>
                <Text style={s.v}>{v}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function rows(lease: any, money: (n: number) => string): [string, string][] {
  return [
    ['Monthly rent', money(lease.rentAmount)],
    ['Billing cycle', lease.billingCycle],
    ['Start date', lease.startDate],
    ['End date', lease.endDate || '-'],
  ];
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
    docTitle: { fontSize: 15, color: t.colors.ink, fontWeight: '700', fontFamily: fontFamily(t) },
    row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
    k: { color: t.colors.muted, fontSize: 14, fontFamily: fontFamily(t) },
    v: { color: t.colors.ink, fontSize: 14, fontWeight: '600', textTransform: 'capitalize', fontFamily: fontFamily(t) },
  });
}

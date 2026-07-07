import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, money } from '../ui';

export default function LeaseScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [lease, setLease] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myLease().then(setLease).catch(() => setLease(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;
  if (!lease) return <View style={s.center}><Text style={s.muted}>No active lease found.</Text></View>;

  const rows: [string, string][] = [
    ['Status', lease.status],
    ['Type', lease.type],
    ['Monthly rent', money(lease.rentAmount)],
    ['Billing cycle', lease.billingCycle],
    ['Start date', lease.startDate],
    ['End date', lease.endDate || '-'],
  ];

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.heading}>Lease details</Text>
      <Card style={{ padding: 4 }}>
        {rows.map(([k, v], idx) => (
          <View key={k} style={[s.row, idx === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={s.k}>{k}</Text>
            <Text style={s.v}>{v}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    muted: { color: t.colors.muted, fontFamily: fontFamily(t) },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
    k: { color: t.colors.muted, fontSize: 14, fontFamily: fontFamily(t) },
    v: { color: t.colors.ink, fontSize: 14, fontWeight: '600', textTransform: 'capitalize', fontFamily: fontFamily(t) },
  });
}

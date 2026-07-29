import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, money, hexToRgba } from '../ui';

type Agreement = { ref: string; status: string; signUrl: string; fileUrl: string } | null;

export default function DocsScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [lease, setLease] = useState<any>(null);
  const [agreement, setAgreement] = useState<Agreement>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [ls, ag] = await Promise.all([
      api.myLease().catch(() => null),
      api.myLeaseAgreement().catch(() => null),
    ]);
    setLease(ls);
    setAgreement(ag);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (url?: string) => {
    if (!url) return;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Could not open', 'The document link could not be opened.'); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  const signed = agreement?.status === 'signed';
  const needsSign = agreement?.status === 'sent';

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Documents</Text>

      {/* Lease agreement document — review/sign or view the signed copy. */}
      {agreement ? (
        <Card style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.docIcon}><Ionicons name="document-text-outline" size={22} color={t.colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>Lease agreement</Text>
              <Text style={s.muted}>{signed ? 'Signed' : needsSign ? 'Awaiting your signature' : agreement.status}</Text>
            </View>
            <Pill label={signed ? 'Signed' : needsSign ? 'Sign' : agreement.status}
              tone={signed ? 'success' : needsSign ? 'danger' : 'muted'} />
          </View>
          {needsSign && (
            <TouchableOpacity style={[s.btn, { backgroundColor: t.colors.brand }]} onPress={() => open(agreement.signUrl)} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={t.colors.onBrand} />
              <Text style={[s.btnText, { color: t.colors.onBrand }]}>Review &amp; sign</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => open(agreement.fileUrl)} activeOpacity={0.85}>
            <Ionicons name="eye-outline" size={18} color={t.colors.brand} />
            <Text style={[s.btnText, { color: t.colors.brand }]}>{signed ? 'View signed lease' : 'View document'}</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <Card style={{ marginBottom: 12 }}><Text style={s.muted}>Your lease agreement isn’t available yet. It will appear here once your agent sends it.</Text></Card>
      )}

      {/* Lease terms summary. */}
      {lease && (
        <>
          <Text style={s.section}>Lease terms</Text>
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
    section: { fontSize: 15, fontWeight: '700', color: t.colors.ink, marginBottom: 10, fontFamily: fontFamily(t, true) },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
    docTitle: { fontSize: 15, color: t.colors.ink, fontWeight: '700', fontFamily: fontFamily(t) },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: 12 },
    btnGhost: { backgroundColor: hexToRgba(t.colors.brand, 0.10) },
    btnText: { fontSize: 14, fontWeight: '700', fontFamily: fontFamily(t) },
    row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
    k: { color: t.colors.muted, fontSize: 14, fontFamily: fontFamily(t) },
    v: { color: t.colors.ink, fontSize: 14, fontWeight: '600', textTransform: 'capitalize', fontFamily: fontFamily(t) },
  });
}

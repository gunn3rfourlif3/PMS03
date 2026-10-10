import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, hexToRgba } from '../ui';
import { useLocale } from '../i18n';
import type { TFunction } from '../../../shared/i18n';

type Agreement = { ref: string; status: string; signUrl: string; fileUrl: string } | null;

export default function DocsScreen({ navigation }: any) {
  const t = useTheme();
  const { t: tr, money, date } = useLocale();
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
    catch { Alert.alert(tr('tenant.docs.couldNotOpenTitle'), tr('tenant.docs.couldNotOpenBody')); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  const signed = agreement?.status === 'signed';
  const needsSign = agreement?.status === 'sent';

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>{tr('tenant.docs.title')}</Text>

      {/* Lease agreement document — review/sign or view the signed copy. */}
      {agreement ? (
        <Card style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.docIcon}><Ionicons name="document-text-outline" size={22} color={t.colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.docTitle}>{tr('tenant.docs.leaseAgreement')}</Text>
              <Text style={s.muted}>{signed ? tr('tenant.docs.signedStatus') : needsSign ? tr('tenant.docs.awaitingSignature') : agreement.status}</Text>
            </View>
            <Pill label={signed ? tr('tenant.docs.signedStatus') : needsSign ? tr('tenant.docs.signPill') : agreement.status}
              tone={signed ? 'success' : needsSign ? 'danger' : 'muted'} />
          </View>
          {needsSign && (
            <TouchableOpacity style={[s.btn, { backgroundColor: t.colors.brand }]} onPress={() => open(agreement.signUrl)} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={t.colors.onBrand} />
              <Text style={[s.btnText, { color: t.colors.onBrand }]}>{tr('tenant.docs.reviewAndSign')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => open(agreement.fileUrl)} activeOpacity={0.85}>
            <Ionicons name="eye-outline" size={18} color={t.colors.brand} />
            <Text style={[s.btnText, { color: t.colors.brand }]}>{signed ? tr('tenant.docs.viewSigned') : tr('tenant.docs.viewDocument')}</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <Card style={{ marginBottom: 12 }}><Text style={s.muted}>{tr('tenant.docs.notAvailable')}</Text></Card>
      )}

      {/* Lease terms summary. */}
      {lease && (
        <>
          <Text style={s.section}>{tr('tenant.docs.leaseTerms')}</Text>
          <Card style={{ padding: 4 }}>
            {rows(tr, lease, money, date).map(([k, v], idx, arr) => (
              <View key={k} style={[s.row, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.k}>{k}</Text>
                <Text style={s.v}>{v}</Text>
              </View>
            ))}
          </Card>
          {/* Entry point for the revived Lease screen: the full detail view
              adds the lease's status and type, which this summary omits. */}
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => navigation?.navigate('Lease')} activeOpacity={0.85}>
            <Ionicons name="list-outline" size={18} color={t.colors.brand} />
            <Text style={[s.btnText, { color: t.colors.brand }]}>{tr('tenant.docs.viewFullLease')}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function rows(
  t: TFunction,
  lease: any,
  money: (n: number) => string,
  date: (v: string) => string,
): [string, string][] {
  return [
    [t('tenant.docs.row.monthlyRent'), money(lease.rentAmount)],
    // `billingCycle` is an API enum with no key set on this screen, so it shows
    // as sent. The `textTransform: 'capitalize'` on the value style was doing
    // the formatting and does nothing outside the Latin alphabet — flagged in
    // the Day 6 log rather than guessed at.
    [t('tenant.docs.row.billingCycle'), lease.billingCycle],
    [t('tenant.docs.row.startDate'), date(lease.startDate)],
    [t('tenant.docs.row.endDate'), lease.endDate ? date(lease.endDate) : '-'],
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

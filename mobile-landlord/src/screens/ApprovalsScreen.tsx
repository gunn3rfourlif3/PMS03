import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter } from '../ui';
import { useLocale } from '../i18n';
import type { MessageKey, TFunction } from '../../../shared/i18n';

const nextMonthFirst = () => {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
};

const statusTone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'screening' ? 'brand' : 'muted';

const STATUSES = ['submitted', 'screening', 'approved', 'rejected'] as const;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`landlord.approvals.status.${st}` as MessageKey) : st;

/* The screening verdict. Unlike web-admin's /applications — where the
   recommendation is free text shown as sent — this screen compares it against
   'approve'/'decline' to pick a colour, so the vocabulary IS known here and can
   be keyed. An unexpected verdict renders as itself. */
const VERDICTS = ['approve', 'decline', 'review'] as const;
const verdictLabel = (t: TFunction, v: string): string =>
  (VERDICTS as readonly string[]).includes(v) ? t(`landlord.approvals.recommendation.${v}` as MessageKey) : v;

export default function ApprovalsScreen() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const s = useMemo(() => makeStyles(t), [t]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setApps(await api.applications()); } catch (e: any) { Alert.alert(tr('landlord.common.error'), e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); } catch (e: any) { Alert.alert(tr('landlord.common.error'), e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>{tr('landlord.approvals.title')}</Text>
      {apps.map((a) => (
        <Card key={a.id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{a.applicantName}</Text>
              <Text style={s.muted}>{a.applicantEmail}</Text>
            </View>
            <Pill label={statusLabel(tr, a.status)} tone={statusTone(a.status)} />
          </View>

          {a.screeningResult?.recommendation && (
            <View style={s.recRow}>
              <Text style={s.recLabel}>{tr('landlord.approvals.screeningLabel')}</Text>
              <Pill
                label={verdictLabel(tr, a.screeningResult.recommendation)}
                tone={a.screeningResult.recommendation === 'approve' ? 'success' : a.screeningResult.recommendation === 'decline' ? 'danger' : 'muted'}
              />
            </View>
          )}

          {(a.status === 'submitted' || a.status === 'screening') && (
            <View style={s.actions}>
              {a.status === 'submitted' && (
                <Button label={tr('landlord.approvals.screen')} variant="secondary" onPress={() => act(() => api.screen(a.id))} style={{ flex: 1 }} />
              )}
              {a.status === 'screening' && (
                <>
                  <Button label={tr('landlord.approvals.approve')} onPress={() => act(() => api.approve(a.id, nextMonthFirst()))} style={{ flex: 1 }} />
                  <Button label={tr('landlord.approvals.reject')} variant="secondary" onPress={() => act(() => api.reject(a.id))} style={{ flex: 1 }} />
                </>
              )}
            </View>
          )}
        </Card>
      ))}
      {apps.length === 0 && <Card><Text style={s.muted}>{tr('landlord.approvals.empty')}</Text></Card>}
      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    name: { fontSize: 16, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t) },
    muted: { color: t.colors.muted, fontSize: 13, marginTop: 2, fontFamily: fontFamily(t) },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    recLabel: { fontSize: 13, color: t.colors.muted, fontFamily: fontFamily(t) },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  });
}

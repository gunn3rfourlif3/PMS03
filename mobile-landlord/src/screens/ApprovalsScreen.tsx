import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter } from '../ui';

const nextMonthFirst = () => {
  const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
};

const statusTone = (s: string): 'brand' | 'success' | 'danger' | 'muted' =>
  s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : s === 'screening' ? 'brand' : 'muted';

export default function ApprovalsScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setApps(await api.applications()); } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Applications</Text>
      {apps.map((a) => (
        <Card key={a.id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{a.applicantName}</Text>
              <Text style={s.muted}>{a.applicantEmail}</Text>
            </View>
            <Pill label={a.status} tone={statusTone(a.status)} />
          </View>

          {a.screeningResult?.recommendation && (
            <View style={s.recRow}>
              <Text style={s.recLabel}>Screening</Text>
              <Pill
                label={a.screeningResult.recommendation}
                tone={a.screeningResult.recommendation === 'approve' ? 'success' : a.screeningResult.recommendation === 'decline' ? 'danger' : 'muted'}
              />
            </View>
          )}

          {(a.status === 'submitted' || a.status === 'screening') && (
            <View style={s.actions}>
              {a.status === 'submitted' && (
                <Button label="Screen" variant="secondary" onPress={() => act(() => api.screen(a.id))} style={{ flex: 1 }} />
              )}
              {a.status === 'screening' && (
                <>
                  <Button label="Approve" onPress={() => act(() => api.approve(a.id, nextMonthFirst()))} style={{ flex: 1 }} />
                  <Button label="Reject" variant="secondary" onPress={() => act(() => api.reject(a.id))} style={{ flex: 1 }} />
                </>
              )}
            </View>
          )}
        </Card>
      ))}
      {apps.length === 0 && <Card><Text style={s.muted}>No applications right now.</Text></Card>}
      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.colors.bg },
    center: { flex: 1, justifyContent: 'center', backgroundColor: t.colors.bg },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    name: { fontSize: 16, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t) },
    muted: { color: t.colors.muted, fontSize: 13, marginTop: 2, fontFamily: fontFamily(t) },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    recLabel: { fontSize: 13, color: t.colors.muted, fontFamily: fontFamily(t) },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  });
}

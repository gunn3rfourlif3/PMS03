import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import {
  Button, BrandFooter, hexToRgba,
  BentoTile, BentoHero, ProgressBar, SectionTitle, ListCard, Row, EmptyRow,
} from '../ui';
import { useLocale } from '../i18n';

const thisPeriod = () => new Date().toISOString().slice(0, 7);

export default function DashboardScreen() {
  const t = useTheme();
  const { t: tr, tn, money, percent } = useLocale();
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
  const owed = arrears ? Number(arrears.total) : 0;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}
    >
      <Text style={s.heading}>{tr('landlord.dashboard.title')}</Text>

      {/* Collected is the number an agency principal actually opens the app for,
          so it gets the hero and the rest arrange around it. */}
      <BentoHero
        tone="purple"
        eyebrow={tr('landlord.dashboard.collectedFor', { period })}
        value={collection ? money(collection.collected) : '—'}
        caption={collection ? tr('landlord.dashboard.ofBilled', { amount: money(collection.billed) }) : undefined}
        chip={tr('landlord.dashboard.ratePill', { rate: percent(Math.round(rate) / 100, 0) })}
      >
        <View style={{ marginTop: 16 }}>
          <ProgressBar value={rate} tone="purple" />
        </View>
      </BentoHero>

      <View style={s.row}>
        <BentoTile tone="coral" icon="alert-circle-outline" value={owed ? money(owed) : money(0)}
          label={arrears?.arrears
            ? tn('landlord.dashboard.arrearsTenants', Number(arrears.arrears))
            : tr('landlord.dashboard.arrears')} />
        <BentoTile tone="amber" icon="construct-outline" value={openTickets == null ? '—' : String(openTickets)}
          label={tr('landlord.dashboard.openTickets')} />
      </View>
      <View style={s.row}>
        <BentoTile tone="blue" icon="home-outline" value={String(rentRoll.length)} label={tr('landlord.dashboard.activeLeases')} />
        <BentoTile tone="teal" icon="trending-up-outline" value={percent(Math.round(rate) / 100, 0)} label={tr('landlord.dashboard.collectionRate')} />
      </View>

      <View style={s.periodRow}>
        <Text style={s.muted}>{tr('landlord.dashboard.period')}</Text>
        <TextInput style={s.periodInput} value={period} onChangeText={setPeriod} onSubmitEditing={load} />
        <Button label={tr('landlord.dashboard.refresh')} variant="secondary" icon="refresh" onPress={load} style={{ paddingVertical: 9, paddingHorizontal: 14 }} />
      </View>

      <SectionTitle>{tr('landlord.dashboard.rentRoll')}</SectionTitle>
      <ListCard>
        {rentRoll.length === 0 && <EmptyRow>{tr('landlord.dashboard.noLeases')}</EmptyRow>}
        {rentRoll.map((r, idx) => {
          const behind = Number(r.outstanding) > 0;
          return (
            <Row
              key={r.lease_id}
              first={idx === 0}
              leftIcon={behind ? 'alert-circle' : 'home'}
              leftTone={behind ? 'coral' : 'teal'}
              title={r.unit}
              subtitle={r.status === 'active' ? tr('landlord.dashboard.occupied') : r.status}
              right={money(r.rent_amount)}
              rightSub={behind
                ? tr('landlord.dashboard.amountDue', { amount: money(r.outstanding) })
                : tr('landlord.dashboard.perMonth')}
            />
          );
        })}
      </ListCard>

      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 22, fontWeight: '700', color: t.colors.ink, marginBottom: 16, fontFamily: fontFamily(t, true) },
    row: { flexDirection: 'row', gap: 12, marginTop: 12 },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    periodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
    periodInput: {
      borderWidth: 1, borderColor: t.colors.line, borderRadius: 10, padding: 9, width: 110,
      backgroundColor: hexToRgba(t.colors.card, 0.8), color: t.colors.ink, fontFamily: fontFamily(t),
    },
  });
}

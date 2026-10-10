import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import {
  Button, BentoTile, BentoHero, SectionTitle, ListCard, Row, EmptyRow,
} from '../ui';
import { useLocale } from '../i18n';
import type { TFunction } from '../../../shared/i18n';
import { TabKey } from '../components/BottomNav';

/* Returns a STATE as well as a label: the hero's colour was previously chosen
   by string-comparing the label against 'Overdue', which breaks the moment the
   label is translated. */
type DueState = 'none' | 'overdue' | 'today' | 'future';
const dueState = (d?: string): { state: DueState; days: number } => {
  if (!d) return { state: 'none', days: 0 };
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return { state: 'overdue', days };
  if (days === 0) return { state: 'today', days };
  return { state: 'future', days };
};
const dueLabel = (
  t: TFunction,
  tn: (base: string, count: number) => string,
  d?: string,
): string => {
  const { state, days } = dueState(d);
  if (state === 'none') return '';
  if (state === 'overdue') return t('tenant.home.overdue');
  if (state === 'today') return t('tenant.home.dueToday');
  return tn('tenant.home.dueIn', days);
};

export default function HomeScreen({ navigation, goTab }: { navigation: any; goTab: (k: TabKey) => void }) {
  const t = useTheme();
  const { t: tr, tn, money, date } = useLocale();
  const s = useMemo(() => makeStyles(t), [t]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [name, setName] = useState<string>('');
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, prof, unreadRes] = await Promise.all([
        api.myInvoices(),
        api.profile().catch(() => null),
        api.messageUnread().catch(() => null),
      ]);
      setInvoices(inv);
      setName((prof?.name || '').split(' ')[0] || '');
      setUnread(Number(unreadRes?.count) || 0);
    } catch (e: any) { Alert.alert(tr('tenant.common.couldNotLoad'), e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const due = invoices.find((i) => i.status !== 'paid' && i.status !== 'void');
  const paid = invoices.filter((i) => i.status === 'paid');

  const pay = async () => {
    if (!due) return;
    setPaying(true);
    try {
      const res = await api.initiatePayment(due.id, 'eft');
      if (res.redirectUrl) await Linking.openURL(res.redirectUrl);
      else Alert.alert(tr('tenant.common.paymentStartedTitle'), tr('tenant.common.paymentReference', { ref: res.paymentId }));
    } catch (e: any) { Alert.alert(tr('tenant.common.paymentFailed'), e.message); }
    finally { setPaying(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  // The hero carries the state of the tenancy in one glance: warm when money is
  // owed, calm when it isn't. Colour does the work a status label used to.
  // Compares the STATE, not the rendered label — see `dueState` above.
  const overdue = !!due && dueState(due.dueDate).state === 'overdue';
  const heroTone = !due ? 'teal' : overdue ? 'coral' : 'amber';

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}
    >
      {/* Two keys rather than a conditional suffix: a language that puts the
          name before the greeting cannot be served by appending. */}
      <Text style={s.greeting}>{name ? tr('tenant.home.greetingNamed', { name }) : tr('tenant.home.greeting')}</Text>

      <BentoHero
        tone={heroTone}
        eyebrow={due ? tr('tenant.home.periodRent', { period: due.period }) : tr('tenant.home.rent')}
        value={due ? money(due.total) : money(0)}
        caption={due
          ? (due.dueDate ? tr('tenant.home.includesVatDue', { date: date(due.dueDate) }) : tr('tenant.home.includesVat'))
          : tr('tenant.home.nothingOutstanding')}
        chip={due ? dueLabel(tr, tn, due.dueDate) : tr('tenant.home.allPaid')}
      >
        {due ? <Button label={tr('tenant.home.payRent')} onPress={pay} busy={paying} style={{ marginTop: 18 }} /> : null}
      </BentoHero>

      <View style={s.tiles}>
        <BentoTile testID="tile-pay" tone="blue" icon="card-outline" value={tr('tenant.home.tile.pay')} label={tr('tenant.home.tile.payLabel')} onPress={() => goTab('pay')} />
        <BentoTile testID="tile-maintenance" tone="purple" icon="construct-outline" value={tr('tenant.home.tile.log')} label={tr('tenant.home.tile.maintenance')} onPress={() => navigation.navigate('Maintenance')} />
      </View>
      <View style={s.tiles}>
        <BentoTile testID="tile-lease" tone="green" icon="document-text-outline" value={tr('tenant.home.tile.lease')} label={tr('tenant.home.tile.leaseLabel')} onPress={() => goTab('docs')} />
        <BentoTile
          testID="tile-messages" tone="pink" icon="chatbubbles-outline" value={tr('tenant.home.tile.chat')} label={tr('tenant.home.tile.messages')}
          chip={unread > 0 ? (unread > 9 ? '9+' : String(unread)) : undefined}
          onPress={() => navigation.navigate('Messages')}
        />
      </View>

      <SectionTitle>{tr('tenant.home.recent')}</SectionTitle>
      <ListCard>
        {paid.length === 0 && <EmptyRow>{tr('tenant.home.noActivity')}</EmptyRow>}
        {paid.slice(0, 4).map((i, idx) => (
          <Row
            key={i.id}
            first={idx === 0}
            leftIcon="checkmark-circle"
            leftTone="teal"
            title={tr('tenant.home.paymentReceived')}
            subtitle={i.period}
            right={money(i.total)}
          />
        ))}
      </ListCard>
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    greeting: { fontSize: 22, fontWeight: '700', color: t.colors.ink, marginBottom: 16, fontFamily: fontFamily(t, true) },
    tiles: { flexDirection: 'row', gap: 12, marginTop: 12 },
  });
}

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import {
  Button, money, BentoTile, BentoHero, SectionTitle, ListCard, Row, EmptyRow,
} from '../ui';
import { TabKey } from '../components/BottomNav';

const dueLabel = (d?: string) => {
  if (!d) return '';
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
};

export default function HomeScreen({ navigation, goTab }: { navigation: any; goTab: (k: TabKey) => void }) {
  const t = useTheme();
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
    } catch (e: any) { Alert.alert('Could not load', e.message); }
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
      else Alert.alert('Payment started', 'Reference: ' + res.paymentId);
    } catch (e: any) { Alert.alert('Payment failed', e.message); }
    finally { setPaying(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  // The hero carries the state of the tenancy in one glance: warm when money is
  // owed, calm when it isn't. Colour does the work a status label used to.
  const overdue = !!due && dueLabel(due.dueDate) === 'Overdue';
  const heroTone = !due ? 'teal' : overdue ? 'coral' : 'amber';

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}
    >
      <Text style={s.greeting}>Hi{name ? ` ${name}` : ''}</Text>

      <BentoHero
        tone={heroTone}
        eyebrow={due ? `${due.period} rent` : 'Rent'}
        value={due ? money(due.total) : money(0)}
        caption={due ? `Includes VAT${due.dueDate ? ` · due ${due.dueDate}` : ''}` : 'Nothing outstanding'}
        chip={due ? dueLabel(due.dueDate) : 'All paid'}
      >
        {due ? <Button label="Pay rent" onPress={pay} busy={paying} style={{ marginTop: 18 }} /> : null}
      </BentoHero>

      <View style={s.tiles}>
        <BentoTile tone="blue" icon="card-outline" value="Pay" label="Rent & history" onPress={() => goTab('pay')} />
        <BentoTile tone="purple" icon="construct-outline" value="Log" label="Maintenance" onPress={() => navigation.navigate('Maintenance')} />
      </View>
      <View style={s.tiles}>
        <BentoTile tone="green" icon="document-text-outline" value="Lease" label="Your documents" onPress={() => goTab('docs')} />
        <BentoTile
          tone="pink" icon="chatbubbles-outline" value="Chat" label="Messages"
          chip={unread > 0 ? (unread > 9 ? '9+' : String(unread)) : undefined}
          onPress={() => navigation.navigate('Messages')}
        />
      </View>

      <SectionTitle>Recent</SectionTitle>
      <ListCard>
        {paid.length === 0 && <EmptyRow>No recent activity.</EmptyRow>}
        {paid.slice(0, 4).map((i, idx) => (
          <Row
            key={i.id}
            first={idx === 0}
            leftIcon="checkmark-circle"
            leftTone="teal"
            title="Payment received"
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

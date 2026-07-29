import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, money, hexToRgba } from '../ui';
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

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.greeting}>Hi{name ? ` ${name}` : ''}</Text>

      <Card style={{ marginBottom: 16 }}>
        <View style={s.rowBetween}>
          <Text style={s.muted}>{due ? `${due.period} rent` : 'Rent'}</Text>
          {due ? <Pill label={dueLabel(due.dueDate)} tone="danger" /> : <Pill label="All paid" tone="success" />}
        </View>
        <Text style={s.amount}>{due ? money(due.total) : money(0)}</Text>
        <Text style={s.muted}>{due ? `Includes VAT${due.dueDate ? ` · due ${due.dueDate}` : ''}` : 'Nothing outstanding'}</Text>
        {due && <Button label="Pay rent" onPress={pay} busy={paying} style={{ marginTop: 16 }} />}
      </Card>

      <View style={s.tiles}>
        <Tile t={t} icon="card-outline" label="Pay" onPress={() => goTab('pay')} />
        <Tile t={t} icon="construct-outline" label="Log ticket" onPress={() => navigation.navigate('Maintenance')} />
        <Tile t={t} icon="document-text-outline" label="Lease" onPress={() => goTab('docs')} />
        <Tile t={t} icon="chatbubbles-outline" label="Messages" badge={unread} onPress={() => navigation.navigate('Messages')} />
      </View>

      <Text style={s.section}>Recent</Text>
      <Card>
        {paid.length === 0 && <Text style={s.muted}>No recent activity.</Text>}
        {paid.slice(0, 4).map((i, idx) => (
          <View key={i.id} style={[s.activity, idx > 0 && s.activityBorder]}>
            <Ionicons name="checkmark-circle" size={22} color={t.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={s.activityTitle}>Payment received</Text>
              <Text style={s.muted}>{i.period} · {money(i.total)}</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Tile({ t, icon, label, onPress, badge = 0 }: { t: Branding; icon: any; label: string; onPress: () => void; badge?: number }) {
  const s = makeStyles(t);
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} activeOpacity={0.85}>
      <View style={s.tileIcon}>
        <Ionicons name={icon} size={22} color={t.colors.brand} />
        {badge > 0 && (
          <View style={s.tileBadge}>
            <Text style={s.tileBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    greeting: { fontSize: 22, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    amount: { fontSize: 32, fontWeight: '700', color: t.colors.ink, marginVertical: 6, fontFamily: fontFamily(t, true) },
    tiles: { flexDirection: 'row', gap: 10, marginBottom: 22 },
    tile: {
      flex: 1, backgroundColor: hexToRgba(t.colors.card, 0.55), borderRadius: 14, borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), paddingVertical: 16, alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
    },
    tileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    tileBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e5484d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: hexToRgba(t.colors.card, 0.9) },
    tileBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 13 },
    tileLabel: { fontSize: 12, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
    section: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    activityBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.line },
    activityTitle: { fontSize: 15, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
  });
}

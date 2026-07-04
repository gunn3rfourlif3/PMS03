import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter, money } from '../ui';

export default function DashboardScreen({ navigation }: any) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signOut } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try { setInvoices(await api.myInvoices()); }
    catch (e: any) { Alert.alert('Could not load', e.message); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const due = invoices.find((i) => i.status !== 'paid' && i.status !== 'void');

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
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Card style={{ marginBottom: 16 }}>
        <View style={s.rowBetween}>
          <Text style={s.muted}>{due ? `${due.period} rent` : 'Rent'}</Text>
          {due ? <Pill label={`Due ${due.dueDate}`} tone="danger" /> : <Pill label="All paid" tone="success" />}
        </View>
        <Text style={s.amount}>{due ? money(due.total) : money(0)}</Text>
        <Text style={s.muted}>{due ? 'Includes VAT' : 'Nothing outstanding'}</Text>
        {due && <Button label="Pay rent" onPress={pay} busy={paying} style={{ marginTop: 16 }} />}
      </Card>

      <View style={s.actions}>
        <Action t={t} icon="R" label="Pay" onPress={pay} disabled={!due} />
        <Action t={t} icon="L" label="Lease" onPress={() => navigation.navigate('Lease')} />
        <Action t={t} icon="->" label="Sign out" onPress={signOut} />
      </View>

      <Text style={s.sectionTitle}>Invoices</Text>
      {invoices.length === 0 && <Card><Text style={s.muted}>No invoices yet.</Text></Card>}
      {invoices.map((i) => (
        <Card key={i.id} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.invoicePeriod}>{i.period}</Text>
            <Text style={s.muted}>{money(i.total)}</Text>
          </View>
          <Pill label={i.status} tone={i.status === 'paid' ? 'success' : 'danger'} />
        </Card>
      ))}
      <BrandFooter />
    </ScrollView>
  );
}

function Action({ t, icon, label, onPress, disabled }: { t: Branding; icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  const s = makeStyles(t);
  return (
    <TouchableOpacity style={[s.action, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <View style={s.actionIcon}><Text style={s.actionIconText}>{icon}</Text></View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: t.colors.bg },
    center: { flex: 1, justifyContent: 'center', backgroundColor: t.colors.bg },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    amount: { fontSize: 32, fontWeight: '700', color: t.colors.ink, marginVertical: 6, fontFamily: fontFamily(t, true) },
    actions: { flexDirection: 'row', gap: 10, marginBottom: 22 },
    action: {
      flex: 1, backgroundColor: t.colors.card, borderRadius: 14, borderWidth: 1, borderColor: t.colors.line, paddingVertical: 16, alignItems: 'center',
      shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
    },
    actionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionIconText: { color: t.colors.brand, fontWeight: '700', fontSize: 15, fontFamily: fontFamily(t, true) },
    actionLabel: { fontSize: 12, color: t.colors.ink, fontFamily: fontFamily(t) },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    invoicePeriod: { fontSize: 15, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
  });
}

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BentoHero, SectionTitle, ListCard, Row, EmptyRow } from '../ui';
import { useLocale } from '../i18n';

export default function PayScreen() {
  const t = useTheme();
  const { t: tr, money, date } = useLocale();
  const s = useMemo(() => makeStyles(t), [t]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [lease, setLease] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, la] = await Promise.all([api.myInvoices(), api.myLeaseAgreement().catch(() => null)]);
      setInvoices(inv); setLease(la);
    } catch (e: any) { Alert.alert(tr('tenant.common.couldNotLoad'), e.message); }
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
      else { Alert.alert(tr('tenant.common.paymentStartedTitle'), tr('tenant.common.paymentReference', { ref: res.paymentId })); await load(); }
    } catch (e: any) { Alert.alert(tr('tenant.common.paymentFailed'), e.message); }
    finally { setPaying(false); }
  };

  const uploadProof = async () => {
    if (!due) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a: any = res.assets[0];
    setUploading(true);
    try {
      await api.uploadProof(due.id, { uri: a.uri, name: a.fileName ?? 'proof.jpg', mimeType: a.mimeType ?? 'image/jpeg', file: a.file });
      Alert.alert(tr('tenant.pay.proofSentTitle'), tr('tenant.pay.proofSentBody'));
      await load();
    } catch (e: any) { Alert.alert(tr('tenant.pay.uploadFailed'), e.message); }
    finally { setUploading(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>{tr('tenant.pay.title')}</Text>

      {lease && lease.status !== 'signed' && (
        <Card style={{ marginBottom: 16, borderWidth: 1, borderColor: t.colors.brand }}>
          <Text style={s.section}>{tr('tenant.pay.leaseAgreement')}</Text>
          <Text style={s.muted}>{tr('tenant.pay.signFirst')}</Text>
          <Button label={tr('tenant.pay.reviewAndSign')} onPress={() => lease.signUrl && Linking.openURL(lease.signUrl)} style={{ marginTop: 12 }} />
        </Card>
      )}
      {lease && lease.status === 'signed' && (
        <Card style={{ marginBottom: 16 }}>
          <View style={s.rowBetween}><Text style={s.muted}>{tr('tenant.pay.leaseAgreement')}</Text><Pill label={tr('tenant.pay.signed')} tone="success" /></View>
        </Card>
      )}

      <BentoHero
        tone={due ? 'amber' : 'teal'}
        eyebrow={due ? tr('tenant.home.periodRent', { period: due.period }) : tr('tenant.home.rent')}
        value={due ? money(due.total) : money(0)}
        caption={due ? tr('tenant.home.includesVat') : tr('tenant.home.nothingOutstanding')}
        chip={due ? tr('tenant.pay.due', { date: date(due.dueDate) }) : tr('tenant.home.allPaid')}
      >
        {due ? (
          <>
            <Button label={tr('tenant.home.payRent')} onPress={pay} busy={paying} style={{ marginTop: 18 }} />
            <Button label={tr('tenant.pay.uploadProof')} variant="secondary" onPress={uploadProof} busy={uploading} style={{ marginTop: 10 }} />
          </>
        ) : null}
      </BentoHero>

      <SectionTitle>{tr('tenant.pay.history')}</SectionTitle>
      <ListCard>
        {invoices.length === 0 && <EmptyRow>{tr('tenant.pay.noInvoices')}</EmptyRow>}
        {invoices.map((i, idx) => {
          // An unpaid invoice's status comes from the API and has no catalogue
          // on this screen, so it shows as sent.
          const isPaid = i.status === 'paid';
          return (
            <Row
              key={i.id}
              first={idx === 0}
              leftIcon={isPaid ? 'checkmark-circle' : 'time-outline'}
              leftTone={isPaid ? 'teal' : 'amber'}
              title={i.period}
              subtitle={isPaid ? tr('tenant.pay.paid') : i.status}
              right={money(i.total)}
            />
          );
        })}
      </ListCard>
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
    amount: { fontSize: 30, fontWeight: '700', color: t.colors.ink, marginVertical: 6, fontFamily: fontFamily(t, true) },
    section: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    period: { fontSize: 15, color: t.colors.ink, fontWeight: '600', fontFamily: fontFamily(t) },
  });
}

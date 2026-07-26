import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, money } from '../ui';

export default function PayScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [uploading, setUploading] = useState(false);

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
      else { Alert.alert('Payment started', 'Reference: ' + res.paymentId); await load(); }
    } catch (e: any) { Alert.alert('Payment failed', e.message); }
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
      Alert.alert('Proof sent', 'Thanks — we’ve received your proof of payment and will confirm it shortly.');
      await load();
    } catch (e: any) { Alert.alert('Upload failed', e.message); }
    finally { setUploading(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Payments</Text>
      <Card style={{ marginBottom: 16 }}>
        <View style={s.rowBetween}>
          <Text style={s.muted}>{due ? `${due.period} rent` : 'Rent'}</Text>
          {due ? <Pill label={`Due ${due.dueDate}`} tone="danger" /> : <Pill label="All paid" tone="success" />}
        </View>
        <Text style={s.amount}>{due ? money(due.total) : money(0)}</Text>
        <Text style={s.muted}>{due ? 'Includes VAT' : 'Nothing outstanding'}</Text>
        {due && <Button label="Pay rent" onPress={pay} busy={paying} style={{ marginTop: 16 }} />}
        {due && <Button label="Upload proof of payment" variant="secondary" onPress={uploadProof} busy={uploading} style={{ marginTop: 10 }} />}
      </Card>

      <Text style={s.section}>History</Text>
      {invoices.length === 0 && <Card><Text style={s.muted}>No invoices yet.</Text></Card>}
      {invoices.map((i) => (
        <Card key={i.id} style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.period}>{i.period}</Text>
            <Text style={s.muted}>{money(i.total)}</Text>
          </View>
          <Pill label={i.status} tone={i.status === 'paid' ? 'success' : 'danger'} />
        </Card>
      ))}
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

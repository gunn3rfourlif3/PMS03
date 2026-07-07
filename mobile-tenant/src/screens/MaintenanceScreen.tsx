import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter } from '../ui';

const CATEGORIES = ['Plumbing', 'Electrical', 'Appliance', 'General'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const statusTone = (s: string): 'brand' | 'danger' | 'success' | 'muted' =>
  s === 'closed' ? 'muted' : s === 'resolved' ? 'success' : s === 'assigned' ? 'brand' : 'danger';

export default function MaintenanceScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Plumbing');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, lease] = await Promise.all([api.myTickets(), api.myLease().catch(() => null)]);
      setTickets(mine); setUnitId(lease?.unitId ?? null);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!unitId) { Alert.alert('No active lease', 'You need an active lease to report an issue.'); return; }
    if (!description.trim()) { Alert.alert('Add a description', 'Tell us what needs fixing.'); return; }
    setBusy(true);
    try {
      await api.createTicket({ unitId, category: category.toLowerCase(), description: description.trim(), priority });
      setDescription(''); setPriority('medium'); setCategory('Plumbing');
      await load();
      Alert.alert('Reported', 'Your maintenance request has been logged.');
    } catch (e: any) { Alert.alert('Could not submit', e.message); } finally { setBusy(false); }
  };

  const approve = async (id: string) => {
    try { await api.approveTicket(id); await load(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={s.formTitle}>Report an issue</Text>

        <Text style={s.label}>Category</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} t={t} label={c} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        <Text style={s.label}>Priority</Text>
        <View style={s.chips}>
          {PRIORITIES.map((p) => (
            <Chip key={p} t={t} label={p} active={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>

        <Text style={s.label}>What's wrong?</Text>
        <TextInput
          style={s.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Kitchen tap is leaking"
          placeholderTextColor={t.colors.muted}
          multiline
        />
        <Button label="Submit request" onPress={submit} busy={busy} style={{ marginTop: 14 }} />
      </Card>

      <Text style={s.section}>My requests</Text>
      {tickets.map((tk) => (
        <Card key={tk.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.cat}>{tk.category}</Text>
              <Text style={s.desc}>{tk.description}</Text>
            </View>
            <Pill label={tk.status} tone={statusTone(tk.status)} />
          </View>
          {tk.status === 'resolved' && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.resolvedNote}>Work is done — please confirm to close it out.</Text>
              <Button label="Approve & close" onPress={() => approve(tk.id)} style={{ marginTop: 10 }} />
            </View>
          )}
        </Card>
      ))}
      {tickets.length === 0 && <Card><Text style={s.muted}>No requests yet.</Text></Card>}
      <BrandFooter />
    </ScrollView>
  );
}

function Chip({ t, label, active, onPress }: { t: Branding; label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
        borderColor: active ? t.colors.brand : t.colors.line,
        backgroundColor: active ? t.colors.tint : t.colors.card,
      }}
    >
      <Text style={{ color: active ? t.colors.brand : t.colors.muted, fontWeight: '600', fontSize: 13, textTransform: 'capitalize', fontFamily: fontFamily(t) }}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    formTitle: { fontSize: 17, fontWeight: '700', color: t.colors.ink, marginBottom: 8, fontFamily: fontFamily(t, true) },
    label: { fontSize: 13, color: t.colors.muted, marginTop: 12, marginBottom: 8, fontFamily: fontFamily(t) },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    input: { borderWidth: 1, borderColor: t.colors.line, borderRadius: 10, padding: 12, minHeight: 70, color: t.colors.ink, backgroundColor: 'transparent', textAlignVertical: 'top', fontFamily: fontFamily(t) },
    section: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: t.colors.ink, fontFamily: fontFamily(t, true) },
    cat: { fontSize: 16, fontWeight: '700', color: t.colors.ink, textTransform: 'capitalize', fontFamily: fontFamily(t) },
    desc: { fontSize: 14, color: t.colors.ink, marginTop: 3, fontFamily: fontFamily(t) },
    resolvedNote: { fontSize: 13, color: t.colors.success, fontWeight: '600', fontFamily: fontFamily(t) },
    muted: { color: t.colors.muted, fontSize: 13, fontFamily: fontFamily(t) },
  });
}

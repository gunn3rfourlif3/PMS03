import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter } from '../ui';
import { useLocale } from '../i18n';
import type { MessageKey, TFunction } from '../../../shared/i18n';

/**
 * The category values are now LOWERCASE, matching what the API already
 * received: `submit` used to send `category.toLowerCase()`, so the stored value
 * is unchanged — only the display moved to the catalogue. Keeping the English
 * title-case strings as state would have meant translating the value sent to
 * the server, which would write Chinese into the ticket record.
 */
const CATEGORIES = ['plumbing', 'electrical', 'appliance', 'general'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const STATUSES = ['open', 'assigned', 'resolved', 'closed'] as const;

const categoryLabel = (t: TFunction, c: string): string =>
  (CATEGORIES as readonly string[]).includes(c) ? t(`tenant.maintenance.category.${c}` as MessageKey) : c;
const priorityLabel = (t: TFunction, p: string): string =>
  (PRIORITIES as readonly string[]).includes(p) ? t(`tenant.maintenance.priority.${p}` as MessageKey) : p;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`tenant.maintenance.status.${st}` as MessageKey) : st;

const statusTone = (s: string): 'brand' | 'danger' | 'success' | 'muted' =>
  s === 'closed' ? 'muted' : s === 'resolved' ? 'success' : s === 'assigned' ? 'brand' : 'danger';

export default function MaintenanceScreen() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('plumbing');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, lease] = await Promise.all([api.myTickets(), api.myLease().catch(() => null)]);
      setTickets(mine); setUnitId(lease?.unitId ?? null);
    } catch (e: any) { Alert.alert(tr('tenant.common.error'), e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!unitId) { Alert.alert(tr('tenant.maintenance.noLeaseTitle'), tr('tenant.maintenance.noLeaseBody')); return; }
    if (!description.trim()) { Alert.alert(tr('tenant.maintenance.noDescriptionTitle'), tr('tenant.maintenance.noDescriptionBody')); return; }
    setBusy(true);
    try {
      // `category` is already the lowercase value the API expects.
      await api.createTicket({ unitId, category, description: description.trim(), priority });
      setDescription(''); setPriority('medium'); setCategory('plumbing');
      await load();
      Alert.alert(tr('tenant.maintenance.reportedTitle'), tr('tenant.maintenance.reportedBody'));
    } catch (e: any) { Alert.alert(tr('tenant.maintenance.submitFailed'), e.message); } finally { setBusy(false); }
  };

  const approve = async (id: string) => {
    try { await api.approveTicket(id); await load(); } catch (e: any) { Alert.alert(tr('tenant.common.error'), e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Card style={{ marginBottom: 16 }}>
        <Text style={s.formTitle}>{tr('tenant.maintenance.title')}</Text>

        <Text style={s.label}>{tr('tenant.maintenance.category')}</Text>
        <View style={s.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} t={t} label={categoryLabel(tr, c)} active={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        <Text style={s.label}>{tr('tenant.maintenance.priority')}</Text>
        <View style={s.chips}>
          {PRIORITIES.map((p) => (
            <Chip key={p} t={t} label={priorityLabel(tr, p)} active={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>

        <Text style={s.label}>{tr('tenant.maintenance.whatsWrong')}</Text>
        <TextInput
          style={s.input}
          value={description}
          onChangeText={setDescription}
          placeholder={tr('tenant.maintenance.descriptionPlaceholder')}
          placeholderTextColor={t.colors.muted}
          multiline
        />
        <Button label={tr('tenant.maintenance.submit')} onPress={submit} busy={busy} style={{ marginTop: 14 }} />
      </Card>

      <Text style={s.section}>{tr('tenant.maintenance.myRequests')}</Text>
      {tickets.map((tk) => (
        <Card key={tk.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={s.cat}>{categoryLabel(tr, tk.category)}</Text>
              <Text style={s.desc}>{tk.description}</Text>
            </View>
            <Pill label={statusLabel(tr, tk.status)} tone={statusTone(tk.status)} />
          </View>
          {tk.status === 'resolved' && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.resolvedNote}>{tr('tenant.maintenance.resolvedNote')}</Text>
              <Button label={tr('tenant.maintenance.approveClose')} onPress={() => approve(tk.id)} style={{ marginTop: 10 }} />
            </View>
          )}
        </Card>
      ))}
      {tickets.length === 0 && <Card><Text style={s.muted}>{tr('tenant.maintenance.noRequests')}</Text></Card>}
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

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter, hexToRgba } from '../ui';
import { useLocale } from '../i18n';
import type { MessageKey, TFunction } from '../../../shared/i18n';

const priorityTone = (p: string): 'brand' | 'danger' | 'success' | 'muted' =>
  p === 'urgent' || p === 'high' ? 'danger' : p === 'low' ? 'muted' : 'brand';
const statusTone = (s: string): 'brand' | 'danger' | 'success' | 'muted' =>
  s === 'closed' ? 'muted' : s === 'resolved' ? 'success' : s === 'assigned' ? 'brand' : 'danger';
const shortId = (id?: string) => (id ? id.slice(0, 8) : '');

/* The same category/priority/status vocabulary the tenant app sends, keyed
   under `landlord.*` so a manager's wording can differ from a tenant's. The
   `textTransform: 'capitalize'` on the category style was doing the display
   formatting and does nothing outside the Latin alphabet. */
const CATEGORIES = ['plumbing', 'electrical', 'appliance', 'general'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const STATUSES = ['open', 'assigned', 'resolved', 'closed'] as const;
const WO_STATUSES = ['assigned', 'in_progress', 'completed'] as const;

const categoryLabel = (t: TFunction, c: string): string =>
  (CATEGORIES as readonly string[]).includes(c) ? t(`landlord.tickets.category.${c}` as MessageKey) : c;
const priorityLabel = (t: TFunction, p: string): string =>
  (PRIORITIES as readonly string[]).includes(p) ? t(`landlord.tickets.priority.${p}` as MessageKey) : p;
const statusLabel = (t: TFunction, st: string): string =>
  (STATUSES as readonly string[]).includes(st) ? t(`landlord.tickets.status.${st}` as MessageKey) : st;
const woStatusLabel = (t: TFunction, st: string): string =>
  (WO_STATUSES as readonly string[]).includes(st) ? t(`landlord.tickets.wo.${st}` as MessageKey) : st;

export default function TicketsScreen() {
  const t = useTheme();
  const { t: tr, money } = useLocale();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [wos, setWos] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [tk, wo, pr] = await Promise.all([api.tickets(), api.workOrders(), api.providers().catch(() => [])]);
      setTickets(tk); setWos(wo); setProviders(Array.isArray(pr) ? pr.filter((p: any) => p.status === 'active') : []);
    } catch (e: any) { Alert.alert(tr('landlord.common.error'), e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); } catch (e: any) { Alert.alert(tr('landlord.common.error'), e.message); }
  };
  const woFor = (ticketId: string) => wos.filter((w) => w.ticketId === ticketId)[0];
  // providers matching the ticket category first, then the rest
  const providersFor = (cat: string) => {
    const match = providers.filter((p) => p.category === cat);
    const rest = providers.filter((p) => p.category !== cat);
    return [...match, ...rest];
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>{tr('landlord.tickets.title')}</Text>
      {tickets.map((tk) => {
        const wo = woFor(tk.id);
        const chosen = pick[tk.id];
        const list = providersFor(tk.category);
        return (
          <Card key={tk.id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cat}>{categoryLabel(tr, tk.category)}</Text>
                <Text style={s.desc}>{tk.description}</Text>
                <Text style={s.meta}>{tr('landlord.tickets.unit', { id: shortId(tk.unitId) })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Pill label={priorityLabel(tr, tk.priority)} tone={priorityTone(tk.priority)} />
                <Pill label={statusLabel(tr, tk.status)} tone={statusTone(tk.status)} />
              </View>
            </View>

            {wo && (
              <View style={s.woRow}>
                {/* Two keys rather than appending the contractor: a language
                    that orders those clauses differently cannot be served by
                    concatenation. */}
                <Text style={s.meta}>
                  {wo.contractorName
                    ? tr('landlord.tickets.workOrderWithContractor', { id: shortId(wo.id), status: woStatusLabel(tr, wo.status), contractor: wo.contractorName })
                    : tr('landlord.tickets.workOrder', { id: shortId(wo.id), status: woStatusLabel(tr, wo.status) })}
                </Text>
                {Number(wo.cost) > 0 && <Text style={s.meta}>{money(wo.cost)}</Text>}
              </View>
            )}

            {/* Assign: pick a service provider, then create the work order */}
            {tk.status === 'open' && !wo && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.pickLabel}>{tr('landlord.tickets.assignTo')}</Text>
                <View style={s.chips}>
                  {list.map((p) => {
                    const on = chosen === p.id;
                    return (
                      <TouchableOpacity key={p.id} onPress={() => setPick({ ...pick, [tk.id]: on ? '' : p.id })} activeOpacity={0.8}
                        style={[s.chip, { borderColor: on ? t.colors.brand : t.colors.line, backgroundColor: on ? hexToRgba(t.colors.brand, 0.12) : hexToRgba(t.colors.card, 0.5) }]}>
                        <Text style={{ color: on ? t.colors.brand : t.colors.muted, fontWeight: '600', fontSize: 12, fontFamily: fontFamily(t) }}>
                          {p.category === tk.category ? tr('landlord.tickets.providerMatch', { name: p.name }) : p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {list.length === 0 && <Text style={s.meta}>{tr('landlord.tickets.noProviders')}</Text>}
                </View>
                <Button
                  label={chosen
                    ? tr('landlord.tickets.assignToNamed', { name: list.find((p) => p.id === chosen)?.name ?? '' })
                    : tr('landlord.tickets.assignNoContractor')}
                  onPress={() => act(() => api.assignTicket(tk.id, chosen || undefined))}
                  style={{ marginTop: 10 }}
                />
              </View>
            )}
            {wo?.status === 'assigned' && (
              <View style={s.actions}><Button label={tr('landlord.tickets.startWork')} onPress={() => act(() => api.startWorkOrder(wo.id))} style={{ flex: 1 }} /></View>
            )}
            {wo?.status === 'in_progress' && (
              <View style={s.completeRow}>
                <TextInput
                  style={s.cost}
                  value={costs[wo.id] ?? ''}
                  onChangeText={(v) => setCosts({ ...costs, [wo.id]: v })}
                  placeholder={tr('landlord.tickets.costPlaceholder')}
                  placeholderTextColor={t.colors.muted}
                  keyboardType="numeric"
                />
                <Button
                  label={tr('landlord.tickets.complete')}
                  onPress={() => act(() => api.completeWorkOrder(wo.id, Number(costs[wo.id] || 0)))}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {tk.status === 'resolved' && <Text style={s.awaiting}>{tr('landlord.tickets.awaitingTenant')}</Text>}
            {tk.status === 'closed' && <Text style={s.meta}>{tr('landlord.tickets.closed')}</Text>}
          </Card>
        );
      })}
      {tickets.length === 0 && <Card><Text style={s.meta}>{tr('landlord.tickets.empty')}</Text></Card>}
      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    cat: { fontSize: 16, fontWeight: '700', color: t.colors.ink, textTransform: 'capitalize', fontFamily: fontFamily(t) },
    desc: { fontSize: 14, color: t.colors.ink, marginTop: 3, fontFamily: fontFamily(t) },
    meta: { fontSize: 12, color: t.colors.muted, marginTop: 3, fontFamily: fontFamily(t) },
    woRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.line },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    completeRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
    cost: { width: 110, borderWidth: 1, borderColor: t.colors.line, borderRadius: 10, padding: 11, color: t.colors.ink, backgroundColor: 'transparent', fontFamily: fontFamily(t) },
    awaiting: { fontSize: 13, color: t.colors.success, marginTop: 12, fontWeight: '600', fontFamily: fontFamily(t) },
    pickLabel: { fontSize: 12, color: t.colors.muted, marginBottom: 6, fontFamily: fontFamily(t) },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  });
}

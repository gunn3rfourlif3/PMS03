import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter, money } from '../ui';

const priorityTone = (p: string): 'brand' | 'danger' | 'success' | 'muted' =>
  p === 'urgent' || p === 'high' ? 'danger' : p === 'low' ? 'muted' : 'brand';
const statusTone = (s: string): 'brand' | 'danger' | 'success' | 'muted' =>
  s === 'closed' ? 'muted' : s === 'resolved' ? 'success' : s === 'assigned' ? 'brand' : 'danger';
const shortId = (id?: string) => (id ? id.slice(0, 8) : '');

export default function TicketsScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [wos, setWos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [tk, wo] = await Promise.all([api.tickets(), api.workOrders()]);
      setTickets(tk); setWos(wo);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<any>) => {
    try { await fn(); await load(); } catch (e: any) { Alert.alert('Error', e.message); }
  };
  // latest work order per ticket
  const woFor = (ticketId: string) => wos.filter((w) => w.ticketId === ticketId)[0];

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Maintenance</Text>
      {tickets.map((tk) => {
        const wo = woFor(tk.id);
        return (
          <Card key={tk.id} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cat}>{tk.category}</Text>
                <Text style={s.desc}>{tk.description}</Text>
                <Text style={s.meta}>Unit {shortId(tk.unitId)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Pill label={tk.priority} tone={priorityTone(tk.priority)} />
                <Pill label={tk.status} tone={statusTone(tk.status)} />
              </View>
            </View>

            {wo && (
              <View style={s.woRow}>
                <Text style={s.meta}>Work order {shortId(wo.id)} · {wo.status}</Text>
                {Number(wo.cost) > 0 && <Text style={s.meta}>{money(wo.cost)}</Text>}
              </View>
            )}

            {/* Actions by state */}
            {tk.status === 'open' && !wo && (
              <View style={s.actions}><Button label="Assign work order" onPress={() => act(() => api.assignTicket(tk.id))} style={{ flex: 1 }} /></View>
            )}
            {wo?.status === 'assigned' && (
              <View style={s.actions}><Button label="Start work" onPress={() => act(() => api.startWorkOrder(wo.id))} style={{ flex: 1 }} /></View>
            )}
            {wo?.status === 'in_progress' && (
              <View style={s.completeRow}>
                <TextInput
                  style={s.cost}
                  value={costs[wo.id] ?? ''}
                  onChangeText={(v) => setCosts({ ...costs, [wo.id]: v })}
                  placeholder="Cost (R)"
                  placeholderTextColor={t.colors.muted}
                  keyboardType="numeric"
                />
                <Button
                  label="Complete"
                  onPress={() => act(() => api.completeWorkOrder(wo.id, Number(costs[wo.id] || 0)))}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {tk.status === 'resolved' && <Text style={s.awaiting}>Resolved — awaiting tenant approval</Text>}
            {tk.status === 'closed' && <Text style={s.meta}>Closed</Text>}
          </Card>
        );
      })}
      {tickets.length === 0 && <Card><Text style={s.meta}>No maintenance tickets.</Text></Card>}
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
  });
}

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, BrandFooter, hexToRgba } from '../ui';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const initials = (n?: string) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function MessagesScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any | null>(null); // inbox row
  const [thread, setThread] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const loadInbox = useCallback(async () => {
    try { setRows(await api.messageInbox()); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadInbox(); }, [loadInbox]));

  const openThread = async (row: any) => {
    setActive(row); setThread(null);
    try {
      setThread(await api.messageThread(row.id));
      loadInbox();
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const send = async () => {
    if (!draft.trim() || !active) return;
    setBusy(true);
    try {
      await api.messageReply(active.id, draft.trim());
      setDraft('');
      setThread(await api.messageThread(active.id));
      loadInbox();
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setBusy(false); }
  };

  const toggleStatus = async () => {
    if (!thread) return;
    const next = thread.conversation.status === 'closed' ? 'open' : 'closed';
    try { await api.messageSetStatus(thread.conversation.id, next); setThread(await api.messageThread(thread.conversation.id)); loadInbox(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  // ---- Thread view ----
  if (active && thread) {
    return (
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.threadHeader}>
          <TouchableOpacity onPress={() => { setActive(null); setThread(null); }} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={t.colors.brand} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.threadTitle} numberOfLines={1}>{thread.conversation.subject}</Text>
            <Text style={s.threadSub} numberOfLines={1}>{active.tenantName || 'Tenant'}</Text>
          </View>
          <TouchableOpacity onPress={toggleStatus}>
            <Pill label={thread.conversation.status === 'closed' ? 'Reopen' : 'Close'} tone={thread.conversation.status === 'closed' ? 'muted' : 'success'} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          {thread.messages.map((m) => {
            const staff = m.senderRole === 'staff';
            return (
              <View key={m.id} style={[s.bubbleRow, { justifyContent: staff ? 'flex-end' : 'flex-start' }]}>
                <View style={[s.bubble, staff ? { backgroundColor: t.colors.brand, borderTopRightRadius: 4 } : { backgroundColor: hexToRgba(t.colors.card, 0.9), borderTopLeftRadius: 4 }]}>
                  <Text style={[s.bubbleText, { color: staff ? t.colors.onBrand : t.colors.ink }]}>{m.body}</Text>
                  <Text style={[s.bubbleTime, { color: staff ? hexToRgba(t.colors.onBrand, 0.75) : t.colors.muted }]}>{when(m.createdAt)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.composer}>
          <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Type a reply…" placeholderTextColor={t.colors.muted} multiline />
          <Button label="" icon="send" onPress={send} busy={busy} style={{ paddingHorizontal: 16 }} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---- Inbox list ----
  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }} refreshControl={<RefreshControl refreshing={false} onRefresh={loadInbox} tintColor={t.colors.brand} />}>
      <Text style={s.heading}>Messages</Text>
      {rows.map((c) => (
        <TouchableOpacity key={c.id} activeOpacity={0.85} onPress={() => openThread(c)}>
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.avatar, { backgroundColor: hexToRgba(t.colors.brand, 0.14) }]}>
                <Text style={{ color: t.colors.brand, fontWeight: '700', fontFamily: fontFamily(t, true) }}>{initials(c.tenantName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.name}>{c.tenantName || 'Tenant'}</Text>
                  <Text style={s.time}>{when(c.lastMessageAt)}</Text>
                </View>
                <Text style={s.subject} numberOfLines={1}>{c.subject}</Text>
                <Text style={s.preview} numberOfLines={1}>{c.lastMessagePreview}</Text>
              </View>
              {c.unread && <View style={[s.dot, { backgroundColor: t.colors.brand }]} />}
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      {rows.length === 0 && <Card><Text style={s.preview}>No conversations yet.</Text></Card>}
      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    name: { fontSize: 15, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t) },
    time: { fontSize: 11, color: t.colors.muted, fontFamily: fontFamily(t) },
    subject: { fontSize: 13, fontWeight: '600', color: t.colors.ink, marginTop: 1, fontFamily: fontFamily(t) },
    preview: { fontSize: 12, color: t.colors.muted, marginTop: 1, fontFamily: fontFamily(t) },
    dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
    threadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
    back: { padding: 4 },
    threadTitle: { fontSize: 16, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) },
    threadSub: { fontSize: 12, color: t.colors.muted, fontFamily: fontFamily(t) },
    bubbleRow: { flexDirection: 'row', marginBottom: 10 },
    bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    bubbleText: { fontSize: 14, fontFamily: fontFamily(t) },
    bubbleTime: { fontSize: 10, marginTop: 4, fontFamily: fontFamily(t) },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.line },
    input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: t.colors.ink, backgroundColor: hexToRgba(t.colors.card, 0.5), fontFamily: fontFamily(t) },
  });
}

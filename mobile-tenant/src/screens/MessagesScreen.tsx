import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Pill, Button, hexToRgba } from '../ui';

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

type Mode = { view: 'list' } | { view: 'thread'; id: string } | { view: 'new' };

export default function MessagesScreen({ navigation }: any) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ view: 'list' });
  const [thread, setThread] = useState<{ conversation: any; messages: any[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const loadList = useCallback(async () => {
    try { setRows(await api.myMessages()); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { loadList(); }, [loadList]));

  const openThread = async (id: string) => {
    setMode({ view: 'thread', id }); setThread(null);
    try { setThread(await api.messageThread(id)); loadList(); setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const send = async () => {
    if (!draft.trim() || mode.view !== 'thread') return;
    setBusy(true);
    try {
      await api.messageReply(mode.id, draft.trim());
      setDraft('');
      setThread(await api.messageThread(mode.id));
      loadList();
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!subject.trim() || !draft.trim()) { Alert.alert('Add a subject and message'); return; }
    setBusy(true);
    try {
      const c = await api.startConversation(subject.trim(), draft.trim());
      setSubject(''); setDraft('');
      await loadList();
      openThread(c.id);
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setBusy(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  // ---- New conversation ----
  if (mode.view === 'new') {
    return (
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.threadHeader}>
            <TouchableOpacity onPress={() => { setMode({ view: 'list' }); setSubject(''); setDraft(''); }} style={s.back}>
              <Ionicons name="chevron-back" size={22} color={t.colors.brand} />
            </TouchableOpacity>
            <Text style={s.threadTitle}>New message</Text>
          </View>
          <Card style={{ marginTop: 8 }}>
            <Text style={s.label}>Subject</Text>
            <TextInput style={s.field} value={subject} onChangeText={setSubject} placeholder="e.g. Leaking tap in kitchen" placeholderTextColor={t.colors.muted} />
            <Text style={[s.label, { marginTop: 14 }]}>Message</Text>
            <TextInput style={[s.field, { height: 120, textAlignVertical: 'top' }]} value={draft} onChangeText={setDraft} placeholder="Write your message to the property manager…" placeholderTextColor={t.colors.muted} multiline />
            <Button label="Send message" onPress={create} busy={busy} style={{ marginTop: 16 }} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- Thread ----
  if (mode.view === 'thread' && thread) {
    return (
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.threadHeader}>
          <TouchableOpacity onPress={() => setMode({ view: 'list' })} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={t.colors.brand} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.threadTitle} numberOfLines={1}>{thread.conversation.subject}</Text>
            <Text style={s.threadSub}>Property manager</Text>
          </View>
          {thread.conversation.status === 'closed' && <Pill label="closed" tone="muted" />}
        </View>
        <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
          {thread.messages.map((m) => {
            const mine = m.senderRole === 'tenant';
            return (
              <View key={m.id} style={[s.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                <View style={[s.bubble, mine ? { backgroundColor: t.colors.brand, borderTopRightRadius: 4 } : { backgroundColor: hexToRgba(t.colors.card, 0.9), borderTopLeftRadius: 4 }]}>
                  <Text style={[s.bubbleText, { color: mine ? t.colors.onBrand : t.colors.ink }]}>{m.body}</Text>
                  <Text style={[s.bubbleTime, { color: mine ? hexToRgba(t.colors.onBrand, 0.75) : t.colors.muted }]}>{when(m.createdAt)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={s.composer}>
          <TextInput style={s.input} value={draft} onChangeText={setDraft} placeholder="Type a message…" placeholderTextColor={t.colors.muted} multiline />
          <Button label="" icon="send" onPress={send} busy={busy} style={{ paddingHorizontal: 16 }} />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ---- List ----
  return (
    <View style={s.wrap}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={false} onRefresh={loadList} tintColor={t.colors.brand} />}>
        <View style={s.listHeader}>
          <Text style={s.heading}>Messages</Text>
          <TouchableOpacity onPress={() => setMode({ view: 'new' })} style={[s.newBtn, { backgroundColor: hexToRgba(t.colors.brand, 0.12) }]}>
            <Ionicons name="create-outline" size={16} color={t.colors.brand} />
            <Text style={{ color: t.colors.brand, fontWeight: '700', fontSize: 13, fontFamily: fontFamily(t) }}>New</Text>
          </TouchableOpacity>
        </View>
        {rows.map((c) => (
          <TouchableOpacity key={c.id} activeOpacity={0.85} onPress={() => openThread(c.id)}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.subject} numberOfLines={1}>{c.subject}</Text>
                    <Text style={s.time}>{when(c.lastMessageAt)}</Text>
                  </View>
                  <Text style={s.preview} numberOfLines={1}>{c.lastMessagePreview}</Text>
                </View>
                {c.unread && <View style={[s.dot, { backgroundColor: t.colors.brand }]} />}
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        {rows.length === 0 && (
          <Card><Text style={s.preview}>No messages yet. Tap “New” to reach your property manager.</Text></Card>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) },
    newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
    subject: { flex: 1, fontSize: 15, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t) },
    time: { fontSize: 11, color: t.colors.muted, marginLeft: 8, fontFamily: fontFamily(t) },
    preview: { fontSize: 13, color: t.colors.muted, marginTop: 3, fontFamily: fontFamily(t) },
    dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
    threadHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.line },
    back: { padding: 4 },
    threadTitle: { fontSize: 16, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) },
    threadSub: { fontSize: 12, color: t.colors.muted, fontFamily: fontFamily(t) },
    label: { fontSize: 12, color: t.colors.muted, marginBottom: 6, fontFamily: fontFamily(t) },
    field: { borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: t.colors.ink, backgroundColor: hexToRgba(t.colors.card, 0.5), fontFamily: fontFamily(t) },
    bubbleRow: { flexDirection: 'row', marginBottom: 10 },
    bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    bubbleText: { fontSize: 14, fontFamily: fontFamily(t) },
    bubbleTime: { fontSize: 10, marginTop: 4, fontFamily: fontFamily(t) },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.line },
    input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: hexToRgba('#ffffff', 0.5), borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: t.colors.ink, backgroundColor: hexToRgba(t.colors.card, 0.5), fontFamily: fontFamily(t) },
  });
}

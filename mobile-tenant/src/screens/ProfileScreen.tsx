import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Button, BrandFooter } from '../ui';

export default function ProfileScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signOut } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.profile().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  const initial = (me?.name || me?.email || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
      <Text style={s.heading}>Profile</Text>
      <Card style={{ alignItems: 'center', paddingVertical: 28, marginBottom: 16 }}>
        <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
        <Text style={s.name}>{me?.name || 'Tenant'}</Text>
        {me?.email ? <Text style={s.muted}>{me.email}</Text> : null}
        {me?.phone ? <Text style={s.muted}>{me.phone}</Text> : null}
      </Card>
      <Button label="Sign out" variant="secondary" onPress={signOut} />
      <BrandFooter />
    </ScrollView>
  );
}

function makeStyles(t: Branding) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', backgroundColor: 'transparent' },
    heading: { fontSize: 20, fontWeight: '700', color: t.colors.ink, marginBottom: 14, fontFamily: fontFamily(t, true) },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    avatarText: { color: t.colors.onBrand, fontSize: 30, fontWeight: '700', fontFamily: fontFamily(t, true) },
    name: { fontSize: 18, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) },
    muted: { color: t.colors.muted, fontSize: 13, marginTop: 3, fontFamily: fontFamily(t) },
  });
}

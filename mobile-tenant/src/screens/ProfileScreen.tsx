import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth-context';
import { Branding, useTheme, fontFamily } from '../theme';
import { Card, Button, BrandFooter } from '../ui';
import { useLocale } from '../i18n';

export default function ProfileScreen({ navigation }: any) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signOut } = useAuth();
  const { t: tr, locale, setLocale, locales, names } = useLocale();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.profile().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={t.colors.brand} /></View>;

  const initial = (me?.name || me?.email || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 130 }}>
      <Text style={s.heading}>{tr('tenant.profile.title')}</Text>
      <Card style={{ alignItems: 'center', paddingVertical: 28, marginBottom: 16 }}>
        <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
        <Text style={s.name}>{me?.name || tr('tenant.profile.nameFallback')}</Text>
        {me?.email ? <Text style={s.muted}>{me.email}</Text> : null}
        {me?.phone ? <Text style={s.muted}>{me.phone}</Text> : null}
      </Card>
      {/* The language switcher. Chips rather than a Picker: a Picker would
          need `@react-native-picker/picker`, and the two shipped locales fit on
          one row. Each chip is labelled in its OWN language, so someone who
          cannot read the current one can still find theirs. Hidden while only
          one locale ships. */}
      {locales.length > 1 && (
        <Card style={{ marginBottom: 16 }}>
          <Text style={s.sectionLabel}>{tr('tenant.profile.language')}</Text>
          <View style={s.langRow}>
            {locales.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setLocale(l)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: l === locale }}
                style={[s.langChip, l === locale && { borderColor: t.colors.brand, backgroundColor: t.colors.tint }]}
              >
                <Text style={[s.langText, l === locale && { color: t.colors.brand }]}>{names[l]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {/* Entry point for the revived Dashboard screen. */}
      <Button label={tr('tenant.profile.accountOverview')} variant="secondary" onPress={() => navigation?.navigate('Dashboard')} style={{ marginBottom: 10 }} />
      <Button label={tr('tenant.profile.signOut')} variant="secondary" onPress={signOut} />
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
    sectionLabel: { fontSize: 13, color: t.colors.muted, marginBottom: 10, fontFamily: fontFamily(t) },
    langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    langChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
      borderColor: t.colors.line, backgroundColor: t.colors.card,
    },
    langText: { color: t.colors.muted, fontWeight: '600', fontSize: 13, fontFamily: fontFamily(t) },
  });
}

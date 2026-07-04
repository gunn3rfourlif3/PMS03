import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, Image, StyleProp, ViewStyle,
} from 'react-native';
import { Branding, useTheme, fontFamily } from './theme';

/** Brand logo: image if provided, else a colored initial tile + wordmark. */
export function Logo({ size = 40, showName = true, light = false }: { size?: number; showName?: boolean; light?: boolean }) {
  const t = useTheme();
  const nameColor = light ? t.colors.onBrand : t.colors.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {t.logo.imageUrl ? (
        <Image source={{ uri: t.logo.imageUrl }} style={{ width: size, height: size, borderRadius: size * 0.28 }} resizeMode="contain" />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: light ? 'rgba(255,255,255,0.18)' : t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.colors.onBrand, fontSize: size * 0.46, fontWeight: '700', fontFamily: fontFamily(t, true) }}>
            {t.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
          </Text>
        </View>
      )}
      {showName && (
        <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: nameColor, fontFamily: fontFamily(t, true) }}>
          {t.logo.text}
        </Text>
      )}
    </View>
  );
}

export function Pill({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'danger' | 'success' | 'muted' }) {
  const t = useTheme();
  const map = {
    brand: { bg: t.colors.tint, fg: t.colors.brand },
    danger: { bg: t.colors.dangerBg, fg: t.colors.danger },
    success: { bg: t.colors.tint, fg: t.colors.success },
    muted: { bg: '#eef0f2', fg: t.colors.muted },
  }[tone];
  return (
    <Text style={{ backgroundColor: map.bg, color: map.fg, fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden', fontFamily: fontFamily(t) }}>
      {label}
    </Text>
  );
}

export function Button({ label, onPress, busy, variant = 'primary', style }: {
  label: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'secondary'; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.85}
      style={[{
        backgroundColor: primary ? t.colors.brand : t.colors.card,
        borderColor: primary ? t.colors.brand : t.colors.line,
        borderWidth: 1, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 18,
        alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1,
      }, style]}
    >
      {busy ? <ActivityIndicator color={primary ? t.colors.onBrand : t.colors.brand} />
        : <Text style={{ color: primary ? t.colors.onBrand : t.colors.ink, fontSize: 15, fontWeight: '600', fontFamily: fontFamily(t) }}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[cardStyle(t), style]}>{children}</View>;
}

export function cardStyle(t: Branding): ViewStyle {
  return {
    backgroundColor: t.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.line,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  };
}

/** Contact strip shown at the foot of primary screens. */
export function BrandFooter() {
  const t = useTheme();
  const c = t.contact;
  if (!c.email && !c.phone && !c.website) return null;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, gap: 4 }}>
      {c.phone ? <Text style={fs(t)} onPress={() => Linking.openURL(`tel:${c.phone}`)}>{c.phone}</Text> : null}
      {c.email ? <Text style={fs(t)} onPress={() => Linking.openURL(`mailto:${c.email}`)}>{c.email}</Text> : null}
      {c.website ? <Text style={[fs(t), { color: t.colors.brand }]} onPress={() => Linking.openURL(`https://${c.website}`)}>{c.website}</Text> : null}
      <Text style={{ fontSize: 11, color: t.colors.muted, marginTop: 8, fontFamily: fontFamily(t) }}>Powered by {t.name}</Text>
    </View>
  );
}
function fs(t: Branding) {
  return { fontSize: 13, color: t.colors.muted, fontFamily: fontFamily(t) } as const;
}

export const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');

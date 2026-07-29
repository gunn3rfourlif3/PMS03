import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Linking, Image, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Branding, useTheme, fontFamily } from './theme';

/** #rrggbb (+optional aa) -> rgba() string. */
export function hexToRgba(hex: string, alpha = 1): string {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/** Lighten/darken a hex by a factor (>1 lighter, <1 darker). */
export function shade(hex: string, factor: number): string {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const cl = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = cl(parseInt(h.slice(0, 2), 16) * factor);
  const g = cl(parseInt(h.slice(2, 4), 16) * factor);
  const b = cl(parseInt(h.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Calm, near-white canvas with a whisper of brand at the top. */
export function GradientBackground({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <LinearGradient
        colors={[hexToRgba(t.colors.brand, 0.06), 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.35 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Clean solid card with a hairline border and soft shadow. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; intensity?: number }) {
  const t = useTheme();
  return <View style={[glassBase(t), style]}>{children}</View>;
}
export function glassBase(t: Branding): ViewStyle {
  return {
    borderRadius: 16, padding: 16,
    backgroundColor: t.colors.card,
    borderWidth: 1, borderColor: t.colors.line,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  };
}
export function cardStyle(t: Branding): ViewStyle { return glassBase(t); }

/** Brand logo: image if provided, else a colored initial tile + wordmark. */
export function Logo({ size = 40, showName = true, light = false }: { size?: number; showName?: boolean; light?: boolean }) {
  const t = useTheme();
  const nameColor = light ? t.colors.onBrand : t.colors.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {t.logo.imageUrl ? (
        <Image source={{ uri: t.logo.imageUrl }} style={{ width: size, height: size, borderRadius: size * 0.28 }} resizeMode="contain" />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden' }}>
          <LinearGradient colors={[shade(t.colors.brand, 1.18), t.colors.brand]} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.colors.onBrand, fontSize: size * 0.46, fontWeight: '700', fontFamily: fontFamily(t, true) }}>
              {t.logo.text.trim()[0]?.toUpperCase() ?? 'P'}
            </Text>
          </View>
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
  const base = { brand: t.colors.brand, danger: t.colors.danger, success: t.colors.success, muted: t.colors.muted }[tone];
  return (
    <Text style={{ backgroundColor: hexToRgba(base, 0.14), color: base, borderColor: hexToRgba(base, 0.28), borderWidth: 1, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden', fontFamily: fontFamily(t) }}>
      {label}
    </Text>
  );
}

export function Button({ label, onPress, busy, variant = 'primary', icon, style }: {
  label: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'secondary';
  icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? t.colors.onBrand : t.colors.ink;
  return (
    <TouchableOpacity
      onPress={onPress} disabled={busy} activeOpacity={0.85}
      style={[{
        flexDirection: 'row', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', opacity: busy ? 0.65 : 1,
        borderWidth: 1, borderColor: primary ? 'transparent' : hexToRgba('#ffffff', 0.5),
        backgroundColor: primary ? undefined : hexToRgba(t.colors.card, 0.5),
      }, style]}
    >
      {primary && <LinearGradient colors={[shade(t.colors.brand, 1.14), t.colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      {busy ? <ActivityIndicator color={primary ? t.colors.onBrand : t.colors.brand} /> : (
        <>
          {icon && <Ionicons name={icon} size={16} color={fg} style={{ marginRight: 8 }} />}
          <Text style={{ color: fg, fontSize: 15, fontWeight: '700', fontFamily: fontFamily(t) }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
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

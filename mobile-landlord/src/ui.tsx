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
  // Every screen in both apps draws its surfaces from here, so the corner radius,
  // padding and shadow set the whole product's tone. The old values (16/16, a
  // 0.04 shadow) read as a plain bordered box; a wider radius with a deeper but
  // softer shadow is what makes a card look like an object sitting on the page
  // rather than an outline drawn on it. Matches the back-office rounded-3xl.
  return {
    borderRadius: 22, padding: 18,
    backgroundColor: t.colors.card,
    borderWidth: 1, borderColor: t.colors.line,
    shadowColor: '#0b1220', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
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
    <Text style={{
      backgroundColor: hexToRgba(base, 0.13), color: base, fontSize: 11.5, fontWeight: '700',
      letterSpacing: 0.3, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 20,
      overflow: 'hidden', textTransform: 'capitalize', fontFamily: fontFamily(t),
    }}>
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
          <Text style={{ color: fg, fontSize: 14, fontWeight: '700', fontFamily: fontFamily(t) }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** Contact strip shown at the foot of primary screens. */
export function BrandFooter() {
  const t = useTheme();
  const c = t.contact;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, gap: 4 }}>
      {c.phone ? <Text style={fs(t)} onPress={() => Linking.openURL(`tel:${c.phone}`)}>{c.phone}</Text> : null}
      {c.email ? <Text style={fs(t)} onPress={() => Linking.openURL(`mailto:${c.email}`)}>{c.email}</Text> : null}
      {c.website ? <Text style={[fs(t), { color: t.colors.brand }]} onPress={() => Linking.openURL(`https://${c.website}`)}>{c.website}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <Text style={[fs(t), { color: t.colors.brand }]} onPress={() => Linking.openURL('https://locare.co.za/privacy')}>Privacy</Text>
        <Text style={fs(t)}>·</Text>
        <Text style={[fs(t), { color: t.colors.brand }]} onPress={() => Linking.openURL('https://locare.co.za/terms')}>Terms</Text>
      </View>
      <Text style={{ fontSize: 11, color: t.colors.muted, marginTop: 8, fontFamily: fontFamily(t) }}>Powered by {t.name}</Text>
    </View>
  );
}
function fs(t: Branding) {
  return { fontSize: 13, color: t.colors.muted, fontFamily: fontFamily(t) } as const;
}

export const money = (n: number) => 'R' + Number(n).toLocaleString('en-ZA');

/* ── Bento primitives ──────────────────────────────────────────────────────
   Ported from the back-office (web-admin/components/ui.tsx) so all three
   surfaces share one visual language. Keep the palette in step with that file.

   These are deliberately NOT theme-derived: they are a fixed, considered set of
   colour pairings, and the readability of the dark text on each background has
   been chosen per tone. Tinting them with an arbitrary vendor brand colour is
   what made the previous cards look washed out and cheap. The vendor's brand
   still owns the chrome — header, buttons, active states — while the data tiles
   stay legible whatever that brand happens to be. */
export const BENTO = {
  purple: { bg: '#AFA9EC', text: '#26215C', sub: '#3C3489', chip: '#CECBF6', bar: '#534AB7' },
  teal:   { bg: '#9FE1CB', text: '#04342C', sub: '#0F6E56', chip: '#C3ECDD', bar: '#0F6E56' },
  coral:  { bg: '#F5C4B3', text: '#4A1B0C', sub: '#993C1D', chip: '#F0D7CD', bar: '#D85A30' },
  amber:  { bg: '#FAC775', text: '#412402', sub: '#854F0B', chip: '#F6D9A2', bar: '#BA7517' },
  blue:   { bg: '#B5D4F4', text: '#042C53', sub: '#185FA5', chip: '#CFE2F7', bar: '#378ADD' },
  pink:   { bg: '#F4C0D1', text: '#4B1528', sub: '#993556', chip: '#F4D3DE', bar: '#D4537E' },
  green:  { bg: '#C0DD97', text: '#173404', sub: '#3B6D11', chip: '#D3E8B6', bar: '#639922' },
} as const;
export type BentoTone = keyof typeof BENTO;

/** Colour-blocked stat tile. The workhorse of the redesigned dashboards. */
export function BentoTile({
  tone, icon, value, label, chip, onPress, style, size = 'md', testID,
}: {
  tone: BentoTone; icon?: keyof typeof Ionicons.glyphMap; value: React.ReactNode; label: string;
  chip?: string; onPress?: () => void; style?: StyleProp<ViewStyle>; size?: 'md' | 'lg';
  // Stable hook for the video recorder. Tile copy is marketing surface and
  // changes; a text selector that silently matches nothing films the wrong
  // screen under the right caption, which is worse than failing.
  testID?: string;
}) {
  const t = useTheme();
  const c = BENTO[tone];
  const body = (
    <View style={[{
      minHeight: size === 'lg' ? 124 : 100, borderRadius: 24, padding: 16,
      backgroundColor: c.bg, justifyContent: 'space-between',
    }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {icon ? <Ionicons name={icon} size={20} color={c.sub} /> : <View />}
        {chip ? (
          <Text style={{
            backgroundColor: c.chip, color: c.text, fontSize: 11, fontWeight: '700',
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
            fontFamily: fontFamily(t),
          }}>{chip}</Text>
        ) : null}
      </View>
      <View style={{ marginTop: 14 }}>
        <Text style={{
          fontSize: size === 'lg' ? 26 : 21, fontWeight: '700', color: c.text,
          fontFamily: fontFamily(t, true),
        }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: c.sub, marginTop: 3, fontFamily: fontFamily(t) }}>
          {label}
        </Text>
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ flex: 1 }} testID={testID}>
      {body}
    </TouchableOpacity>
  );
}

/** Full-width feature tile — the one number a screen is actually about. */
export function BentoHero({
  tone, eyebrow, value, caption, chip, children, style,
}: {
  tone: BentoTone; eyebrow: string; value: React.ReactNode; caption?: string;
  chip?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const c = BENTO[tone];
  return (
    <View style={[{ borderRadius: 28, padding: 22, backgroundColor: c.bg }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: c.sub, fontFamily: fontFamily(t) }}>{eyebrow}</Text>
        {chip ? (
          <Text style={{
            backgroundColor: c.chip, color: c.text, fontSize: 12, fontWeight: '700',
            paddingHorizontal: 11, paddingVertical: 4, borderRadius: 20, overflow: 'hidden',
            fontFamily: fontFamily(t),
          }}>{chip}</Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 34, fontWeight: '700', color: c.text, marginTop: 9, fontFamily: fontFamily(t, true) }}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      {caption ? (
        <Text style={{ fontSize: 12, color: c.sub, marginTop: 4, fontFamily: fontFamily(t) }}>{caption}</Text>
      ) : null}
      {children}
    </View>
  );
}

/** Track + fill, tuned to sit inside a bento tile rather than on white. */
export function ProgressBar({ value, tone = 'teal', height = 10 }: { value: number; tone?: BentoTone; height?: number }) {
  const c = BENTO[tone];
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.chip, overflow: 'hidden' }}>
      <View style={{ height, width: `${v}%`, borderRadius: height, backgroundColor: c.bar }} />
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 22 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) }}>
        {children}
      </Text>
      {action}
    </View>
  );
}

/**
 * A single white surface holding several rows, instead of one card per row.
 * Stacked cards make a list look like a pile of receipts; grouped rows with
 * hairline separators read as one considered object.
 */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{
      backgroundColor: t.colors.card, borderRadius: 22, borderWidth: 1, borderColor: t.colors.line,
      overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    }, style]}>
      {children}
    </View>
  );
}

export function Row({
  title, subtitle, right, rightSub, leftIcon, leftTone, first, onPress,
}: {
  title: string; subtitle?: string; right?: string; rightSub?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap; leftTone?: BentoTone;
  first?: boolean; onPress?: () => void;
}) {
  const t = useTheme();
  const c = leftTone ? BENTO[leftTone] : null;
  const inner = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 13,
      borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: t.colors.line,
    }}>
      {leftIcon ? (
        <View style={{
          width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: c ? c.bg : t.colors.tint,
        }}>
          <Ionicons name={leftIcon} size={19} color={c ? c.sub : t.colors.brand} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: t.colors.ink, fontFamily: fontFamily(t) }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 11.5, color: t.colors.muted, marginTop: 2, fontFamily: fontFamily(t) }}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: t.colors.ink, fontFamily: fontFamily(t, true) }}>{right}</Text>
          {rightSub ? (
            <Text style={{ fontSize: 11, color: t.colors.muted, marginTop: 2, fontFamily: fontFamily(t) }}>{rightSub}</Text>
          ) : null}
        </View>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={17} color={t.colors.muted} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={{ padding: 20, textAlign: 'center', color: t.colors.muted, fontSize: 12.5, fontFamily: fontFamily(t) }}>
      {children}
    </Text>
  );
}

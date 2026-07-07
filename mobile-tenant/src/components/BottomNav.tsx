import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Branding } from '../theme';
import { hexToRgba, shade } from '../ui';

export type TabKey = 'home' | 'pay' | 'docs' | 'profile';

const LEFT: { key: TabKey; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'home', icon: 'home-outline', active: 'home' },
  { key: 'pay', icon: 'card-outline', active: 'card' },
];
const RIGHT: { key: TabKey; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'docs', icon: 'folder-outline', active: 'folder' },
  { key: 'profile', icon: 'person-outline', active: 'person' },
];

/**
 * Floating frosted pill nav with a raised center action button.
 *  onFab -> the central "+" (report an issue).
 */
export default function BottomNav({ active, onChange, onFab }: { active: TabKey; onChange: (k: TabKey) => void; onFab: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.pill, { borderColor: hexToRgba('#ffffff', 0.6) }]}>
        <BlurView intensity={55} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 999, zIndex: -1 }]} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(t.colors.card, 0.45), borderRadius: 999, zIndex: -1 }]} pointerEvents="none" />

        {LEFT.map((it) => <NavBtn key={it.key} t={t} item={it} on={active === it.key} onPress={() => onChange(it.key)} />)}

        <TouchableOpacity activeOpacity={0.9} onPress={onFab} style={styles.fab}>
          <LinearGradient colors={[shade(t.colors.brand, 1.16), t.colors.brand]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="add" size={30} color={t.colors.onBrand} />
        </TouchableOpacity>

        {RIGHT.map((it) => <NavBtn key={it.key} t={t} item={it} on={active === it.key} onPress={() => onChange(it.key)} />)}
      </View>
    </View>
  );
}

function NavBtn({ t, item, on, onPress }: { t: Branding; item: { icon: any; active: any }; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.btn, on && { backgroundColor: hexToRgba(t.colors.brand, 0.10) }]}>
      <Ionicons name={on ? item.active : item.icon} size={23} color={on ? t.colors.brand : hexToRgba(t.colors.muted, 0.9)} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    width: '90%', maxWidth: 440, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  btn: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    transform: [{ translateY: -22 }],
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
});

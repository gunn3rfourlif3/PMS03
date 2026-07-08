import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fontFamily } from '../theme';
import { hexToRgba } from '../ui';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ['grid-outline', 'grid'],
  Approvals: ['people-outline', 'people'],
  Tickets: ['construct-outline', 'construct'],
  Messages: ['chatbubbles-outline', 'chatbubbles'],
  Profile: ['person-outline', 'person'],
};

/** Floating frosted-glass pill tab bar (custom react-navigation tabBar). */
export default function GlassTabBar({ state, descriptors, navigation }: any) {
  const t = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.pill, { borderColor: hexToRgba('#ffffff', 0.6) }]}>
        <BlurView intensity={55} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: 30, zIndex: -1 }]} pointerEvents="none" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(t.colors.card, 0.45), borderRadius: 30, zIndex: -1 }]} pointerEvents="none" />

        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const [outline, filled] = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.8}
              style={[styles.item, focused && { backgroundColor: hexToRgba(t.colors.brand, 0.10) }]}>
              <Ionicons name={focused ? filled : outline} size={22} color={focused ? t.colors.brand : hexToRgba(t.colors.muted, 0.9)} />
              <Text style={{ fontSize: 11, marginTop: 3, color: focused ? t.colors.brand : t.colors.muted, fontWeight: focused ? '700' : '500', fontFamily: fontFamily(t) }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', width: '92%', maxWidth: 460, borderRadius: 30,
    paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 20 },
});

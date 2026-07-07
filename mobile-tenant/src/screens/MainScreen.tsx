import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import BottomNav, { TabKey } from '../components/BottomNav';
import HomeScreen from './HomeScreen';
import PayScreen from './PayScreen';
import DocsScreen from './DocsScreen';
import ProfileScreen from './ProfileScreen';

/** Hosts the four tabs behind a custom bottom nav. `navigation` is the stack,
 *  used to push the Maintenance screen from Home's quick actions. */
export default function MainScreen({ navigation }: any) {
  const t = useTheme();
  const [tab, setTab] = useState<TabKey>('home');

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen navigation={navigation} goTab={setTab} />}
        {tab === 'pay' && <PayScreen />}
        {tab === 'docs' && <DocsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <BottomNav active={tab} onChange={setTab} onFab={() => navigation.navigate('Maintenance')} />
    </View>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { loadToken, setToken, clearToken } from './src/api';
import { AuthContext } from './src/auth-context';
import { ThemeProvider, useTheme, fontFamily } from './src/theme';
import { Logo } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';

const Tab = createBottomTabNavigator();

function Shell() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadToken().then((tok) => { setAuthed(!!tok); setReady(true); }); }, []);

  const auth = useMemo(() => ({
    signIn: async (tok: string) => { await setToken(tok); setAuthed(true); },
    signOut: async () => { await clearToken(); setAuthed(false); },
  }), []);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.bg }}><ActivityIndicator color={t.colors.brand} /></View>;

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer>
        <StatusBar style="light" />
        {authed ? (
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: t.colors.brand },
              headerTintColor: t.colors.onBrand,
              headerTitleStyle: { fontFamily: fontFamily(t, true), fontWeight: '700' },
              tabBarActiveTintColor: t.colors.brand,
              tabBarInactiveTintColor: t.colors.muted,
              tabBarLabelStyle: { fontFamily: fontFamily(t), fontSize: 12 },
            }}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ headerTitle: () => <Logo size={30} light />, title: 'Home' }}
            />
            <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ title: 'Approvals' }} />
          </Tab.Navigator>
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

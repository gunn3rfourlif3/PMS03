import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { api, loadToken, setToken, clearToken, setUnauthorizedHandler } from './src/api';
import { useIdleLogout } from './src/useIdleLogout';
import { IDLE_TIMEOUT_MINUTES } from './src/config';
import { AuthContext } from './src/auth-context';
import { ThemeProvider, useTheme, fontFamily } from './src/theme';
import { LocaleProvider, useT } from './src/i18n';
import { Logo, GradientBackground } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GlassTabBar from './src/components/GlassTabBar';

const Tab = createBottomTabNavigator();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

function Shell() {
  const t = useTheme();
  const tr = useT();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      let tok = await loadToken();
      // No stored session? Try a remembered device — re-auth without an OTP.
      if (!tok) {
        const r = await api.deviceLogin();
        if (r?.accessToken) { await setToken(r.accessToken); tok = r.accessToken; }
      }
      setAuthed(!!tok); setReady(true);
    })();
  }, []);

  const auth = useMemo(() => ({
    signIn: async (tok: string) => { await setToken(tok); setAuthed(true); },
    signOut: async () => { await api.logout().catch(() => {}); await clearToken(); setAuthed(false); },
  }), []);

  const refreshSession = useMemo(() => async () => {
    try { const r = await api.refreshSession(); if (r?.accessToken) await setToken(r.accessToken); } catch { /* let idle timer handle expiry */ }
  }, []);
  const markActive = useIdleLogout(authed, IDLE_TIMEOUT_MINUTES * 60 * 1000, auth.signOut, refreshSession);

  // A rejected (expired) session anywhere in the app drops to the login screen.
  useEffect(() => { setUnauthorizedHandler(() => setAuthed(false)); return () => setUnauthorizedHandler(null); }, []);

  if (!ready || !fontsLoaded) {
    return <GradientBackground><View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={t.colors.brand} /></View></GradientBackground>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <GradientBackground>
       <View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { markActive(); return false; }}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          {authed ? (
            <Tab.Navigator
              tabBar={(props) => <GlassTabBar {...props} />}
              screenOptions={{
                headerStyle: { backgroundColor: t.colors.brand },
                headerTintColor: t.colors.onBrand,
                headerTitleStyle: { fontFamily: fontFamily(t, true), fontWeight: '700' },
              }}
            >
              <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                  headerTitle: () => <Logo size={30} light />,
                  title: tr('landlord.tab.home'),
                  tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
                }}
              />
              <Tab.Screen
                name="Approvals"
                component={ApprovalsScreen}
                options={{ title: tr('landlord.tab.approvals'), tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Tickets"
                component={TicketsScreen}
                options={{ title: tr('landlord.tab.maintenance'), tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{ title: tr('landlord.tab.messages'), tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: tr('landlord.tab.profile'), tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }}
              />
            </Tab.Navigator>
          ) : (
            <LoginScreen />
          )}
        </NavigationContainer>
       </View>
      </GradientBackground>
    </AuthContext.Provider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/* Outside Shell because Shell needs the translator for the tab titles —
          GlassTabBar reads each route's `options.title`, so translating those
          translates the tab bar too. */}
      <LocaleProvider>
        <Shell />
      </LocaleProvider>
    </ThemeProvider>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { api, loadToken, setToken, clearToken } from './src/api';
import { useIdleLogout } from './src/useIdleLogout';
import { IDLE_TIMEOUT_MINUTES } from './src/config';
import { AuthContext } from './src/auth-context';
import { ThemeProvider, useTheme, fontFamily } from './src/theme';
import { Logo, GradientBackground } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import MaintenanceScreen from './src/screens/MaintenanceScreen';
import MessagesScreen from './src/screens/MessagesScreen';

const Stack = createNativeStackNavigator();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } };

function Shell() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadToken().then((tok) => { setAuthed(!!tok); setReady(true); }); }, []);

  const auth = useMemo(() => ({
    signIn: async (token: string) => { await setToken(token); setAuthed(true); },
    signOut: async () => { await clearToken(); setAuthed(false); },
  }), []);

  const refreshSession = useMemo(() => async () => {
    try { const r = await api.refreshSession(); if (r?.accessToken) await setToken(r.accessToken); } catch { /* let idle timer handle expiry */ }
  }, []);
  const markActive = useIdleLogout(authed, IDLE_TIMEOUT_MINUTES * 60 * 1000, auth.signOut, refreshSession);

  if (!ready || !fontsLoaded) {
    return <GradientBackground><View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={t.colors.brand} /></View></GradientBackground>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <GradientBackground>
       <View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { markActive(); return false; }}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: t.colors.brand },
              headerTintColor: t.colors.onBrand,
              headerTitleStyle: { fontWeight: '700', fontFamily: fontFamily(t, true) },
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            {authed ? (
              <>
                <Stack.Screen
                  name="Main"
                  component={MainScreen}
                  options={{
                    headerTitle: () => <Logo size={28} light />,
                    headerRight: () => <Ionicons name="notifications-outline" size={22} color={t.colors.onBrand} />,
                  }}
                />
                <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Report an issue' }} />
                <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
              </>
            ) : (
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
       </View>
      </GradientBackground>
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

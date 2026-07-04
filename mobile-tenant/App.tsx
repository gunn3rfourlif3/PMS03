import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { loadToken, setToken, clearToken } from './src/api';
import { AuthContext } from './src/auth-context';
import { ThemeProvider, useTheme, fontFamily } from './src/theme';
import { Logo } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LeaseScreen from './src/screens/LeaseScreen';

const Stack = createNativeStackNavigator();

function Shell() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadToken().then((tok) => { setAuthed(!!tok); setReady(true); }); }, []);

  const auth = useMemo(() => ({
    signIn: async (token: string) => { await setToken(token); setAuthed(true); },
    signOut: async () => { await clearToken(); setAuthed(false); },
  }), []);

  if (!ready) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.bg }}><ActivityIndicator color={t.colors.brand} /></View>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: t.colors.brand },
            headerTintColor: t.colors.onBrand,
            headerTitleStyle: { fontWeight: '700', fontFamily: fontFamily(t, true) },
            contentStyle: { backgroundColor: t.colors.bg },
          }}
        >
          {authed ? (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerTitle: () => <Logo size={28} light /> }} />
              <Stack.Screen name="Lease" component={LeaseScreen} options={{ title: 'Your lease' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
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

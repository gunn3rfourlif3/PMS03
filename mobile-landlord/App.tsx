import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { BRAND } from './src/config';
import { loadToken, setToken, clearToken } from './src/api';
import { AuthContext } from './src/auth-context';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadToken().then((t) => { setAuthed(!!t); setReady(true); }); }, []);

  const auth = useMemo(() => ({
    signIn: async (t: string) => { await setToken(t); setAuthed(true); },
    signOut: async () => { await clearToken(); setAuthed(false); },
  }), []);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={BRAND.color} /></View>;

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer>
        <StatusBar style="light" />
        {authed ? (
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: BRAND.color },
              headerTintColor: '#fff',
              tabBarActiveTintColor: BRAND.color,
            }}
          >
            <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: BRAND.name }} />
            <Tab.Screen name="Approvals" component={ApprovalsScreen} />
          </Tab.Navigator>
        ) : (
          <LoginScreen />
        )}
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { BRAND } from './src/config';
import { loadToken, setToken, clearToken } from './src/api';
import { AuthContext } from './src/auth-context';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LeaseScreen from './src/screens/LeaseScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    loadToken().then((t) => {
      setAuthed(!!t);
      setReady(true);
    });
  }, []);

  const auth = useMemo(
    () => ({
      signIn: async (token: string) => {
        await setToken(token);
        setAuthed(true);
      },
      signOut: async () => {
        await clearToken();
        setAuthed(false);
      },
    }),
    [],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={BRAND.color} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: BRAND.color },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '500' },
          }}
        >
          {authed ? (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: BRAND.name }} />
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

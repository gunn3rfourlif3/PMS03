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
import { loadToken, setToken, clearToken } from './src/api';
import { AuthContext } from './src/auth-context';
import { ThemeProvider, useTheme, fontFamily } from './src/theme';
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
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  });
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadToken().then((tok) => { setAuthed(!!tok); setReady(true); }); }, []);

  const auth = useMemo(() => ({
    signIn: async (tok: string) => { await setToken(tok); setAuthed(true); },
    signOut: async () => { await clearToken(); setAuthed(false); },
  }), []);

  if (!ready || !fontsLoaded) {
    return <GradientBackground><View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={t.colors.brand} /></View></GradientBackground>;
  }

  return (
    <AuthContext.Provider value={auth}>
      <GradientBackground>
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
                  title: 'Home',
                  tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
                }}
              />
              <Tab.Screen
                name="Approvals"
                component={ApprovalsScreen}
                options={{ title: 'Approvals', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Tickets"
                component={TicketsScreen}
                options={{ title: 'Maintenance', tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }}
              />
              <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }}
              />
            </Tab.Navigator>
          ) : (
            <LoginScreen />
          )}
        </NavigationContainer>
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

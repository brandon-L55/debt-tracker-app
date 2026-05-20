import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DebtProvider, useDebts } from '@/context/DebtContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DebtProvider>
          <AppShell />
        </DebtProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { isLoading } = useDebts();
  const { isDark } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="add-debt" options={{ title: 'Add New Debt' }} />
        <Stack.Screen name="add-individual" options={{ title: 'Add Individual' }} />
        <Stack.Screen name="create-group" options={{ title: 'Create Group' }} />
        <Stack.Screen name="group/[id]" options={{ title: '' }} />
        <Stack.Screen name="individual/[id]" options={{ title: '' }} />
        <Stack.Screen name="add-group-debt" options={{ title: 'Add Group Debt' }} />
        <Stack.Screen name="edit-individual" options={{ title: 'Edit Individual' }} />
        <Stack.Screen name="edit-group" options={{ title: 'Edit Group' }} />
        <Stack.Screen name="settings/profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings/payment-apps" options={{ title: 'Payment Apps' }} />
        <Stack.Screen name="settings/contacts" options={{ title: 'Contacts Access' }} />
        <Stack.Screen name="settings/account" options={{ title: 'Account Settings' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

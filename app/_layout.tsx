import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DebtProvider } from '@/context/DebtContext';
import { ContactsProvider } from '@/context/ContactsContext';
import { GroupsProvider } from '@/context/GroupsContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';


export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
          <DebtProvider>
            {/* ContactsProvider and GroupsProvider are inside DebtProvider so they can call renameDebtPerson */}
            <ContactsProvider>
              <GroupsProvider>
                <AppShell />
              </GroupsProvider>
            </ContactsProvider>
          </DebtProvider>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const { isLoading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  function safeBack() {
    if (router.canGoBack?.()) router.back();
    else router.replace('/(tabs)');
  }

  function safeBackOptions(title: string) {
    return {
      title,
      headerLeft: () => (
        <Pressable onPress={safeBack} hitSlop={8}>
          <Text style={{ color: '#2563EB', fontSize: 16, fontWeight: '600' }}>Back</Text>
        </Pressable>
      ),
    };
  }

  // Wait only for auth session before mounting the navigator.
  // Data loading (debts, contacts, groups) is handled by individual screens.
  if (authLoading) {
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
        <Stack.Screen name="auth" options={{ headerShown: false }} />
<Stack.Screen name="add-debt" options={safeBackOptions('Add New Debt')} />
        <Stack.Screen name="add-individual" options={safeBackOptions('Add Friend')} />
        <Stack.Screen name="add-friends" options={safeBackOptions('Add Friends')} />
        <Stack.Screen name="create-group" options={safeBackOptions('Create Group')} />
        <Stack.Screen name="debt/[id]" options={{ title: '' }} />
        <Stack.Screen name="group/[id]" options={{ title: '' }} />
        <Stack.Screen name="individual/[id]" options={{ title: '' }} />
        <Stack.Screen name="add-group-debt" options={safeBackOptions('Add Group Debt')} />
        <Stack.Screen name="edit-individual" options={safeBackOptions('Edit Friend')} />
        <Stack.Screen name="edit-group" options={safeBackOptions('Edit Group')} />
        <Stack.Screen name="settings/profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings/payment-apps" options={{ title: 'Payment Apps' }} />
        <Stack.Screen name="settings/contacts" options={{ title: 'Contacts' }} />
        <Stack.Screen name="settings/sync-contacts" options={{ title: 'Sync Contacts', headerBackTitle: 'Contacts' }} />
        <Stack.Screen name="settings/blocked-contacts" options={{ title: 'Blocked Contacts', headerBackTitle: 'Contacts' }} />
        <Stack.Screen name="settings/account" options={{ title: 'Account Settings' }} />
        <Stack.Screen name="settings/delete-account" options={{ title: 'Delete Account' }} />
        <Stack.Screen name="nudges" options={{ title: 'Nudges' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

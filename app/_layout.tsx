import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DebtProvider } from '@/context/DebtContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <DebtProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="add-debt" options={{ title: 'Add New Debt' }} />
          <Stack.Screen name="add-individual" options={{ title: 'Add Individual' }} />
          <Stack.Screen name="create-group" options={{ title: 'Create Group' }} />
          <Stack.Screen name="group/[id]" options={{ title: '' }} />
          <Stack.Screen name="individual/[id]" options={{ title: '' }} />
          <Stack.Screen name="add-group-debt" options={{ title: 'Add Group Debt' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </DebtProvider>
  );
}

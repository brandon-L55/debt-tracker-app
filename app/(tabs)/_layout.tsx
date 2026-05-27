import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { hexToRgba } from '@/constants/effects';

export default function TabLayout() {
  const { isDark, colors: t } = useTheme();
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;

  const inactiveColor = isDark ? '#6F7A96' : '#94A3B8';
  const tabBarBorder = isDark ? t.border : '#E2E8F0';

  const glowStyle = isDark
    ? { backgroundColor: hexToRgba(t.from, 0.20), shadowColor: t.from, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14 }
    : { backgroundColor: hexToRgba(t.from, 0.10) };

  function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
    return (
      <View style={styles.iconWrapper}>
        {focused && <View style={[styles.tabGlow, glowStyle]} />}
        <IconSymbol size={24} name={name as any} color={color} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.from,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? t.bg2 : '#FFFFFF',
          borderTopColor: tabBarBorder,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => <TabIcon name="house.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="individuals"
        options={{
          title: 'Individuals',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person.2.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person.3.fill" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <TabIcon name="gear" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', justifyContent: 'center' },
  tabGlow: { position: 'absolute', width: 52, height: 36, borderRadius: 18 },
});

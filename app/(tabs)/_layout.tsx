import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const { isDark, colors: t } = useTheme();
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;

  const activeColor = isDark ? '#C084FC' : '#7C3AED';
  const inactiveColor = isDark ? '#6F7A96' : '#94A3B8';
  const tabBarBg = isDark ? '#0B1020' : '#FFFFFF';
  const tabBarBorder = isDark ? '#2A3152' : '#DDD6FE';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: tabBarBg,
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
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && (
                <View style={[
                  styles.tabGlow,
                  isDark
                    ? { backgroundColor: 'rgba(192,132,252,0.20)', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14 }
                    : { backgroundColor: 'rgba(124,58,237,0.10)' },
                ]} />
              )}
              <IconSymbol size={24} name="house.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="individuals"
        options={{
          title: 'Individuals',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && (
                <View style={[
                  styles.tabGlow,
                  isDark
                    ? { backgroundColor: 'rgba(192,132,252,0.20)', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14 }
                    : { backgroundColor: 'rgba(124,58,237,0.10)' },
                ]} />
              )}
              <IconSymbol size={24} name="person.2.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && (
                <View style={[
                  styles.tabGlow,
                  isDark
                    ? { backgroundColor: 'rgba(192,132,252,0.20)', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14 }
                    : { backgroundColor: 'rgba(124,58,237,0.10)' },
                ]} />
              )}
              <IconSymbol size={24} name="person.3.fill" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && (
                <View style={[
                  styles.tabGlow,
                  isDark
                    ? { backgroundColor: 'rgba(192,132,252,0.20)', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14 }
                    : { backgroundColor: 'rgba(124,58,237,0.10)' },
                ]} />
              )}
              <IconSymbol size={24} name="gear" color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', justifyContent: 'center' },
  tabGlow: { position: 'absolute', width: 52, height: 36, borderRadius: 18 },
});

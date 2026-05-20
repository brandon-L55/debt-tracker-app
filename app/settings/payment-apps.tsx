import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

type App = { key: string; name: string; color: string; description: string };

const APPS: App[] = [
  { key: "venmo", name: "Venmo", color: "#3D95CE", description: "Send & receive via Venmo" },
  { key: "cashapp", name: "Cash App", color: "#00D64F", description: "Send & receive via Cash App" },
  { key: "paypal", name: "PayPal", color: "#003087", description: "Send & receive via PayPal" },
];

export default function PaymentAppsScreen() {
  const { colors: t } = useTheme();
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  function toggle(key: string) {
    if (connected[key]) {
      Alert.alert("Disconnect", `Disconnect ${APPS.find(a => a.key === key)?.name}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => setConnected(p => ({ ...p, [key]: false })) },
      ]);
    } else {
      Alert.alert("Coming Soon", "Payment app integrations are coming in a future update.", [{ text: "OK" }]);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: t.textSub }]}>
        Connect payment apps to quickly request or send money. Integrations coming soon.
      </Text>

      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        {APPS.map((app, i) => {
          const isConnected = !!connected[app.key];
          return (
            <View
              key={app.key}
              style={[styles.row, { borderBottomColor: t.border }, i === APPS.length - 1 && styles.rowLast]}
            >
              <View style={[styles.appIcon, { backgroundColor: app.color + "20" }]}>
                <Text style={[styles.appInitial, { color: app.color }]}>{app.name[0]}</Text>
              </View>
              <View style={styles.appInfo}>
                <Text style={[styles.appName, { color: t.text }]}>{app.name}</Text>
                <Text style={[styles.appDesc, { color: t.textSub }]}>{app.description}</Text>
              </View>
              <Pressable
                style={[
                  styles.toggleBtn,
                  isConnected
                    ? { backgroundColor: t.greenSoft, borderColor: t.greenBorder }
                    : { backgroundColor: t.card, borderColor: t.border },
                ]}
                onPress={() => toggle(app.key)}
              >
                <Text style={[styles.toggleText, { color: isConnected ? t.green : t.textSub }]}>
                  {isConnected ? "Connected" : "Connect"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  appIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  appInitial: { fontSize: 20, fontWeight: "700" },
  appInfo: { flex: 1 },
  appName: { fontSize: 16, fontWeight: "600" },
  appDesc: { fontSize: 12, marginTop: 2 },
  toggleBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  toggleText: { fontSize: 13, fontWeight: "600" },
});

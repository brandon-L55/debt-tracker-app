import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function IndividualsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Individuals</Text>
      <Text style={styles.subtitle}>Manually added people will appear here.</Text>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>+ Add Individual</Text>
      </Pressable>

      <View style={styles.empty}>
        <Text style={styles.emptyText}>No individuals yet.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 60,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  empty: {
    marginTop: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF",
  },
});

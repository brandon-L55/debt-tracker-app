import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debt Tracker</Text>
      <Text style={styles.subtitle}>Your personal debt dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>You owe</Text>
        <Text style={styles.cardValue}>$0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Owed to you</Text>
        <Text style={styles.cardValue}>$0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total paid</Text>
        <Text style={styles.cardValue}>$0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total received</Text>
        <Text style={styles.cardValue}>$0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F8FAFC",
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
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
});

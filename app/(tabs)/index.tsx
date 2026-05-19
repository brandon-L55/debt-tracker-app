import { useDebts } from "@/context/DebtContext";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { debts } = useDebts();

  const youOwe = debts
    .filter((d) => d.direction === "me")
    .reduce((sum, d) => sum + d.amount, 0);

  const owedToYou = debts
    .filter((d) => d.direction === "them")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Debt Tracker</Text>
      <Text style={styles.subtitle}>Your personal debt dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>You owe</Text>
        <Text style={styles.cardValue}>${youOwe.toFixed(2)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Owed to you</Text>
        <Text style={styles.cardValue}>${owedToYou.toFixed(2)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total paid</Text>
        <Text style={styles.cardValue}>$0.00</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Total received</Text>
        <Text style={styles.cardValue}>$0.00</Text>
      </View>

      <Pressable
        style={styles.addButton}
        onPress={() => router.push("/add-debt" as any)}
      >
        <Text style={styles.addButtonText}>+ Add New Debt</Text>
      </Pressable>

      {debts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {debts.map((debt) => (
            <View key={debt.id} style={styles.debtRow}>
              <View style={styles.debtLeft}>
                <Text style={styles.debtPerson}>{debt.person}</Text>
                {debt.reason ? (
                  <Text style={styles.debtReason}>{debt.reason}</Text>
                ) : null}
              </View>
              <View style={styles.debtRight}>
                <Text
                  style={[
                    styles.debtAmount,
                    debt.direction === "me"
                      ? styles.amountOwe
                      : styles.amountOwed,
                  ]}
                >
                  {debt.direction === "me" ? "-" : "+"}${debt.amount.toFixed(2)}
                </Text>
                <Text style={styles.debtDirection}>
                  {debt.direction === "me" ? "You owe" : "Owes you"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
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
  addButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  debtRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  debtLeft: {
    flex: 1,
    marginRight: 12,
  },
  debtPerson: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  debtReason: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  debtRight: {
    alignItems: "flex-end",
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  amountOwe: {
    color: "#DC2626",
  },
  amountOwed: {
    color: "#16A34A",
  },
  debtDirection: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});

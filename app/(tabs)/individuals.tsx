import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";

export default function IndividualsScreen() {
  const router = useRouter();
  const { individuals, debts } = useDebts();

  function netBalance(personName: string): number {
    return debts
      .filter(d => d.person === personName)
      .reduce((sum, d) => sum + (d.direction === "them" ? d.amount : -d.amount), 0);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Individuals</Text>
      <Text style={styles.subtitle}>Manually added people will appear here.</Text>

      <Pressable style={styles.button} onPress={() => router.push("/add-individual")}>
        <Text style={styles.buttonText}>+ Add Individual</Text>
      </Pressable>

      {individuals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No individuals yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {individuals.map(person => {
            const balance = netBalance(person.name);
            const balanceLabel =
              balance === 0
                ? "$0.00"
                : balance > 0
                ? `+$${balance.toFixed(2)}`
                : `-$${Math.abs(balance).toFixed(2)}`;
            const balanceColor =
              balance > 0 ? "#16A34A" : balance < 0 ? "#DC2626" : "#64748B";

            return (
              <Pressable
                key={person.id}
                style={styles.card}
                onPress={() => router.push(`/individual/${person.id}` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardName}>{person.name}</Text>
                    {person.nickname ? (
                      <Text style={styles.cardNickname}>"{person.nickname}"</Text>
                    ) : null}
                  </View>
                  <View style={[styles.balanceBadge, { borderColor: balanceColor + "33" }]}>
                    <Text style={[styles.balanceText, { color: balanceColor }]}>
                      {balanceLabel}
                    </Text>
                  </View>
                </View>
                {person.phoneOrUsername ? (
                  <Text style={styles.cardContact}>{person.phoneOrUsername}</Text>
                ) : null}
                {person.notes ? (
                  <Text style={styles.cardNotes}>{person.notes}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 60, color: "#111827" },
  subtitle: { fontSize: 16, color: "#6B7280", marginTop: 8, marginBottom: 24 },
  button: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  empty: { marginTop: 48, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#9CA3AF" },
  list: { marginTop: 28, gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTitleBlock: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  cardNickname: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  balanceBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F8FAFC",
  },
  balanceText: { fontSize: 14, fontWeight: "700" },
  cardContact: { fontSize: 14, color: "#6B7280", marginBottom: 2 },
  cardNotes: { fontSize: 13, color: "#9CA3AF", fontStyle: "italic", marginTop: 4 },
});

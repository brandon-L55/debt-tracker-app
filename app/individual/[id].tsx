import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";

function statusStyle(status: string) {
  switch (status) {
    case "paid":     return styles.statusPaid;
    case "accepted": return styles.statusAccepted;
    case "rejected": return styles.statusRejected;
    case "disputed": return styles.statusDisputed;
    default:         return styles.statusPending;
  }
}

export default function IndividualDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { individuals, debts } = useDebts();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const person = individuals.find(ind => ind.id === resolvedId);

  if (!person) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Person not found.</Text>
      </View>
    );
  }

  const personDebts = debts
    .filter(d => d.person === person.name)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const iOwe = personDebts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToMe = personDebts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: person.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/edit-individual?id=${resolvedId}` as any)}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar name={person.name} imageUri={person.imageUri} size={72} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{person.name}</Text>
            {person.nickname ? <Text style={styles.nickname}>"{person.nickname}"</Text> : null}
            {person.phoneOrUsername ? <Text style={styles.contact}>{person.phoneOrUsername}</Text> : null}
          </View>
        </View>

        {/* Summary cards */}
        <View style={styles.cardRow}>
          <View style={[styles.summaryCard, styles.cardRed]}>
            <Text style={styles.summaryLabel}>I Owe</Text>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>${iOwe.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.cardGreen]}>
            <Text style={styles.summaryLabel}>Owed to Me</Text>
            <Text style={[styles.summaryValue, { color: "#16A34A" }]}>${owedToMe.toFixed(2)}</Text>
          </View>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Transactions</Text>
        {personDebts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No transactions with {person.name} yet.{"\n"}
              Add debts from the main Dashboard.
            </Text>
          </View>
        ) : (
          personDebts.map(debt => (
            <View key={debt.id} style={styles.txRow}>
              <View style={styles.txLeft}>
                {debt.reason
                  ? <Text style={styles.txReason}>{debt.reason}</Text>
                  : <Text style={styles.txReasonEmpty}>No reason</Text>}
                <View style={styles.txMeta}>
                  <Text style={styles.txDate}>{new Date(debt.createdAt).toLocaleDateString()}</Text>
                  <View style={[styles.statusBadge, statusStyle(debt.status)]}>
                    <Text style={styles.statusText}>{debt.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, debt.direction === "me" ? styles.amountRed : styles.amountGreen]}>
                  {debt.direction === "me" ? "-" : "+"}${debt.amount.toFixed(2)}
                </Text>
                <Text style={styles.txDirection}>{debt.direction === "me" ? "You owe" : "Owes you"}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingBottom: 48 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: { fontSize: 16, color: "#9CA3AF" },
  editBtn: { paddingHorizontal: 4 },
  editBtnText: { color: "#2563EB", fontSize: 16, fontWeight: "600" },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, marginTop: 8 },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  nickname: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  contact: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  cardRed: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  cardGreen: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", fontStyle: "italic", lineHeight: 22 },
  txRow: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  txLeft: { flex: 1, marginRight: 12 },
  txReason: { fontSize: 15, fontWeight: "600", color: "#111827" },
  txReasonEmpty: { fontSize: 15, fontStyle: "italic", color: "#9CA3AF" },
  txMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  txDate: { fontSize: 12, color: "#9CA3AF" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  statusPending:  { backgroundColor: "#F59E0B" },
  statusAccepted: { backgroundColor: "#2563EB" },
  statusPaid:     { backgroundColor: "#16A34A" },
  statusRejected: { backgroundColor: "#DC2626" },
  statusDisputed: { backgroundColor: "#7C3AED" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 17, fontWeight: "700" },
  txDirection: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  amountRed:   { color: "#DC2626" },
  amountGreen: { color: "#16A34A" },
});

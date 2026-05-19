import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";

function statusColor(status: string) {
  switch (status) {
    case "paid":     return styles.statusPaid;
    case "accepted": return styles.statusAccepted;
    case "rejected": return styles.statusRejected;
    case "disputed": return styles.statusDisputed;
    default:         return styles.statusPending;
  }
}

export default function GroupDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { groups, debts } = useDebts();

  const groupId = Array.isArray(id) ? id[0] : id;
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Group not found.</Text>
      </View>
    );
  }

  const groupDebts = debts.filter(d => d.groupId === groupId);
  const iOwe = groupDebts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToMe = groupDebts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);

  const memberBalances = group.members.map(m => {
    const bal = groupDebts
      .filter(d => d.person === m.name)
      .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
    return { member: m, balance: bal };
  });

  const iOweMembers = memberBalances.filter(mb => mb.balance < 0);
  const oweMeMembers = memberBalances.filter(mb => mb.balance > 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/edit-group?id=${groupId}` as any)}
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
          <Avatar name={group.name} imageUri={group.imageUri} size={72} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{group.name}</Text>
            {group.description
              ? <Text style={styles.subtitle}>{group.description}</Text>
              : <Text style={styles.subtitle}>{group.members.length} {group.members.length === 1 ? "member" : "members"}</Text>}
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

        {/* Add debt */}
        <Pressable
          style={styles.addButton}
          onPress={() => router.push(`/add-group-debt?groupId=${groupId}` as any)}
        >
          <Text style={styles.addButtonText}>+ Add Group Debt</Text>
        </Pressable>

        {/* Balance breakdown */}
        {(iOweMembers.length > 0 || oweMeMembers.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Balance Breakdown</Text>
            {iOweMembers.length > 0 && (
              <>
                <Text style={styles.breakdownHeader}>You owe</Text>
                {iOweMembers.map(({ member, balance }) => (
                  <View key={member.id} style={styles.breakdownRow}>
                    <Text style={styles.breakdownName}>{member.name}</Text>
                    <Text style={styles.breakdownAmountRed}>${Math.abs(balance).toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
            {oweMeMembers.length > 0 && (
              <>
                <Text style={styles.breakdownHeader}>Owe you</Text>
                {oweMeMembers.map(({ member, balance }) => (
                  <View key={member.id} style={styles.breakdownRow}>
                    <Text style={styles.breakdownName}>{member.name}</Text>
                    <Text style={styles.breakdownAmountGreen}>${balance.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {groupDebts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No debts in this group yet. Tap "+ Add Group Debt" to get started.</Text>
            </View>
          ) : (
            groupDebts.map(debt => (
              <View key={debt.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txPerson}>{debt.person}</Text>
                  {debt.reason ? <Text style={styles.txReason}>{debt.reason}</Text> : null}
                  <View style={styles.txMeta}>
                    <Text style={styles.txDate}>{new Date(debt.createdAt).toLocaleDateString()}</Text>
                    <View style={[styles.statusBadge, statusColor(debt.status)]}>
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
        </View>
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
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20, marginTop: 8 },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  cardRed: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  cardGreen: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },
  addButton: { backgroundColor: "#2563EB", padding: 16, borderRadius: 14, alignItems: "center", marginBottom: 28 },
  addButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  breakdownHeader: { fontSize: 13, fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  breakdownName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  breakdownAmountRed: { fontSize: 15, fontWeight: "700", color: "#DC2626" },
  breakdownAmountGreen: { fontSize: 15, fontWeight: "700", color: "#16A34A" },
  emptyBox: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", fontStyle: "italic" },
  txRow: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  txLeft: { flex: 1, marginRight: 12 },
  txPerson: { fontSize: 15, fontWeight: "600", color: "#111827" },
  txReason: { fontSize: 13, color: "#6B7280", marginTop: 2 },
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
  amountRed:  { color: "#DC2626" },
  amountGreen: { color: "#16A34A" },
});

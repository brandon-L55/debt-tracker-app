import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";
import type { Group } from "@/context/DebtContext";

function groupTotal(groupId: string, debts: ReturnType<typeof useDebts>["debts"]): number {
  return debts
    .filter(d => d.groupId === groupId)
    .reduce((sum, d) => sum + (d.direction === "them" ? d.amount : -d.amount), 0);
}

function GroupCard({ group, debts }: { group: Group; debts: ReturnType<typeof useDebts>["debts"] }) {
  const router = useRouter();
  const total = groupTotal(group.id, debts);

  const totalLabel =
    total === 0 ? "$0.00" : total > 0 ? `+$${total.toFixed(2)}` : `-$${Math.abs(total).toFixed(2)}`;
  const totalColor = total > 0 ? "#16A34A" : total < 0 ? "#DC2626" : "#64748B";

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/group/${group.id}` as any)}>
      <View style={styles.cardInner}>
        <Avatar name={group.name} imageUri={group.imageUri} size={44} />
        <View style={styles.cardText}>
          <Text style={styles.cardName}>{group.name}</Text>
          <Text style={styles.cardMeta}>
            {group.members.length} {group.members.length === 1 ? "member" : "members"}
          </Text>
          {group.description ? <Text style={styles.cardDescription}>{group.description}</Text> : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardTotal, { color: totalColor }]}>{totalLabel}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const { groups, debts } = useDebts();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Groups</Text>
      <Text style={styles.subtitle}>Trip, event, and friend groups will appear here.</Text>

      <Pressable style={styles.button} onPress={() => router.push("/create-group")}>
        <Text style={styles.buttonText}>+ Create Group</Text>
      </Pressable>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No groups yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {groups.map(group => (
            <GroupCard key={group.id} group={group} debts={debts} />
          ))}
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
  button: { backgroundColor: "#2563EB", padding: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  empty: { marginTop: 48, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#9CA3AF" },
  list: { marginTop: 28, gap: 12 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  cardInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardText: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardMeta: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  cardDescription: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 2 },
  cardTotal: { fontSize: 15, fontWeight: "700" },
  chevron: { fontSize: 20, color: "#CBD5E1" },
});

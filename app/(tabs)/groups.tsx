import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import type { Group } from "@/context/DebtContext";

function groupTotal(groupId: string, debts: ReturnType<typeof useDebts>["debts"]): number {
  return debts
    .filter(d => d.groupId === groupId)
    .reduce((sum, d) => {
      return sum + (d.direction === "them" ? d.amount : -d.amount);
    }, 0);
}

function GroupCard({ group, debts }: { group: Group; debts: ReturnType<typeof useDebts>["debts"] }) {
  const [expanded, setExpanded] = useState(false);
  const total = groupTotal(group.id, debts);
  const groupDebts = debts.filter(d => d.groupId === group.id);

  const totalLabel = total === 0
    ? "$0.00"
    : total > 0
    ? `+$${total.toFixed(2)}`
    : `-$${Math.abs(total).toFixed(2)}`;

  const totalColor = total > 0 ? "#16A34A" : total < 0 ? "#DC2626" : "#64748B";

  return (
    <Pressable style={styles.card} onPress={() => setExpanded(e => !e)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>{group.name}</Text>
          <Text style={styles.cardMeta}>
            {group.members.length} {group.members.length === 1 ? "member" : "members"}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardTotal, { color: totalColor }]}>{totalLabel}</Text>
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </View>

      {group.description ? (
        <Text style={styles.cardDescription}>{group.description}</Text>
      ) : null}

      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.divider} />
          {groupDebts.length === 0 ? (
            <Text style={styles.emptyGroupText}>
              No debts in this group yet. Add debts from the Dashboard.
            </Text>
          ) : (
            group.members.map(member => {
              const memberDebts = groupDebts.filter(d => d.person === member.name);
              const memberTotal = memberDebts.reduce((sum, d) =>
                sum + (d.direction === "them" ? d.amount : -d.amount), 0);
              const label = memberTotal === 0
                ? "Settled"
                : memberTotal > 0
                ? `Owes you $${memberTotal.toFixed(2)}`
                : `You owe $${Math.abs(memberTotal).toFixed(2)}`;
              const labelColor = memberTotal > 0 ? "#16A34A" : memberTotal < 0 ? "#DC2626" : "#9CA3AF";

              return (
                <View key={member.id} style={styles.memberRow}>
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberContact}>{member.phoneOrUsername}</Text>
                  </View>
                  <Text style={[styles.memberBalance, { color: labelColor }]}>{label}</Text>
                </View>
              );
            })
          )}
        </View>
      )}
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
  list: {
    marginTop: 28,
    gap: 12,
  },
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
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  cardMeta: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  cardTotal: {
    fontSize: 16,
    fontWeight: "700",
  },
  chevron: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
  },
  expandedSection: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  emptyGroupText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  memberContact: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 1,
  },
  memberBalance: {
    fontSize: 14,
    fontWeight: "600",
  },
});

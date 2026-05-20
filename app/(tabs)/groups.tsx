import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";
import type { Group, Debt } from "@/context/DebtContext";

type SortOption = "az" | "za" | "date" | "amount-high" | "amount-low" | "members";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "Alphabetical" },
  { value: "za", label: "Reverse Alphabetical" },
  { value: "date", label: "Date Added" },
  { value: "amount-high", label: "Amount Owed: Highest First" },
  { value: "amount-low", label: "Amount Owed: Lowest First" },
  { value: "members", label: "Member Count" },
];

function calcGroupTotal(groupId: string, debts: Debt[]): number {
  return debts
    .filter(d => d.groupId === groupId)
    .reduce((sum, d) => sum + (d.direction === "them" ? d.amount : -d.amount), 0);
}

function GroupCard({ group, debts }: { group: Group; debts: Debt[] }) {
  const router = useRouter();
  const total = calcGroupTotal(group.id, debts);
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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = groups.filter(g => {
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        g.members.some(m => m.name.toLowerCase().includes(q))
      );
    });

    return [...result].sort((a, b) => {
      switch (sort) {
        case "az": return a.name.localeCompare(b.name);
        case "za": return b.name.localeCompare(a.name);
        case "date": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "amount-high": return calcGroupTotal(b.id, debts) - calcGroupTotal(a.id, debts);
        case "amount-low": return calcGroupTotal(a.id, debts) - calcGroupTotal(b.id, debts);
        case "members": return b.members.length - a.members.length;
        default: return 0;
      }
    });
  }, [groups, debts, search, sort]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Groups</Text>
      <Text style={styles.subtitle}>Trip, event, and friend groups will appear here.</Text>

      <Pressable style={styles.button} onPress={() => router.push("/create-group")}>
        <Text style={styles.buttonText}>+ Create Group</Text>
      </Pressable>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable
          style={[styles.sortButton, sort !== "date" && styles.sortButtonActive]}
          onPress={() => setShowSortMenu(true)}
        >
          <Text style={[styles.sortButtonIcon, sort !== "date" && styles.sortButtonIconActive]}>⇅</Text>
        </Pressable>
      </View>

      {sort !== "date" && (
        <Text style={styles.activeSortHint}>Sorted by: {activeSortLabel}</Text>
      )}

      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={styles.sortMenu} onPress={e => e.stopPropagation()}>
            <Text style={styles.sortMenuTitle}>Sort By</Text>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.sortOption, sort === opt.value && styles.sortOptionActive]}
                onPress={() => { setSort(opt.value); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortOptionText, sort === opt.value && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>
                {sort === opt.value && <Text style={styles.sortCheckmark}>✓</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No groups yet.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results found.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(group => (
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
  searchRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  sortButton: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  sortButtonActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  sortButtonIcon: { fontSize: 18, color: "#374151" },
  sortButtonIconActive: { color: "#2563EB" },
  activeSortHint: { fontSize: 12, color: "#6B7280", marginTop: 6, marginLeft: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  sortMenu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 8,
    width: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  sortMenuTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 10,
  },
  sortOptionActive: { backgroundColor: "#EFF6FF" },
  sortOptionText: { flex: 1, fontSize: 15, color: "#374151" },
  sortOptionTextActive: { color: "#2563EB", fontWeight: "600" },
  sortCheckmark: { fontSize: 15, color: "#2563EB", fontWeight: "700" },
  empty: { marginTop: 48, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#9CA3AF" },
  list: { marginTop: 16, gap: 12 },
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

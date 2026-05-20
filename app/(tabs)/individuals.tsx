import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";
import type { Debt } from "@/context/DebtContext";

type SortOption = "az" | "za" | "date" | "balance-high" | "balance-low";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "Alphabetical" },
  { value: "za", label: "Reverse Alphabetical" },
  { value: "date", label: "Date Added" },
  { value: "balance-high", label: "Balance: Highest First" },
  { value: "balance-low", label: "Balance: Lowest First" },
];

function calcNetBalance(personName: string, debts: Debt[]): number {
  return debts
    .filter(d => d.person === personName)
    .reduce((sum, d) => sum + (d.direction === "them" ? d.amount : -d.amount), 0);
}

export default function IndividualsScreen() {
  const router = useRouter();
  const { individuals, debts } = useDebts();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = individuals.filter(p => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q) ||
        (p.phoneOrUsername ?? "").toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q)
      );
    });

    return [...result].sort((a, b) => {
      switch (sort) {
        case "az": return a.name.localeCompare(b.name);
        case "za": return b.name.localeCompare(a.name);
        case "date": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "balance-high": return calcNetBalance(b.name, debts) - calcNetBalance(a.name, debts);
        case "balance-low": return calcNetBalance(a.name, debts) - calcNetBalance(b.name, debts);
        default: return 0;
      }
    });
  }, [individuals, debts, search, sort]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Individuals</Text>
      <Text style={styles.subtitle}>Manually added people will appear here.</Text>

      <Pressable style={styles.button} onPress={() => router.push("/add-individual")}>
        <Text style={styles.buttonText}>+ Add Individual</Text>
      </Pressable>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search individuals..."
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

      {individuals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No individuals yet.</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No results found.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map(person => {
            const balance = calcNetBalance(person.name, debts);
            const balanceLabel =
              balance === 0 ? "$0.00" : balance > 0 ? `+$${balance.toFixed(2)}` : `-$${Math.abs(balance).toFixed(2)}`;
            const balanceColor = balance > 0 ? "#16A34A" : balance < 0 ? "#DC2626" : "#64748B";

            return (
              <Pressable
                key={person.id}
                style={styles.card}
                onPress={() => router.push(`/individual/${person.id}` as any)}
              >
                <View style={styles.cardInner}>
                  <Avatar name={person.name} imageUri={person.imageUri} size={44} />
                  <View style={styles.cardText}>
                    <Text style={styles.cardName}>{person.name}</Text>
                    {person.nickname ? <Text style={styles.cardNickname}>"{person.nickname}"</Text> : null}
                    {person.phoneOrUsername ? <Text style={styles.cardContact}>{person.phoneOrUsername}</Text> : null}
                    {person.notes ? <Text style={styles.cardNotes}>{person.notes}</Text> : null}
                  </View>
                  <View style={[styles.balanceBadge, { borderColor: balanceColor + "44" }]}>
                    <Text style={[styles.balanceText, { color: balanceColor }]}>{balanceLabel}</Text>
                  </View>
                </View>
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
  cardNickname: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  cardContact: { fontSize: 13, color: "#9CA3AF", marginTop: 1 },
  cardNotes: { fontSize: 12, color: "#9CA3AF", fontStyle: "italic", marginTop: 2 },
  balanceBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#F8FAFC" },
  balanceText: { fontSize: 14, fontWeight: "700" },
});

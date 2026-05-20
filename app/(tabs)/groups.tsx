import { useState, useMemo, useCallback, useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
// @ts-ignore — forwardRef deprecation hint from React 19; library still works correctly
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import type { Group, Debt } from "@/context/DebtContext";

type SortOption = "az" | "za" | "date" | "amount-high" | "amount-low" | "members" | "manual";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "Alphabetical" },
  { value: "za", label: "Reverse Alphabetical" },
  { value: "date", label: "Date Added" },
  { value: "amount-high", label: "Amount Owed: Highest First" },
  { value: "amount-low", label: "Amount Owed: Lowest First" },
  { value: "members", label: "Member Count" },
  { value: "manual", label: "Manual Order" },
];

function calcGroupTotal(groupId: string, debts: Debt[]): number {
  return debts.filter(d => d.groupId === groupId)
    .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
}

export default function GroupsScreen() {
  const router = useRouter();
  const { groups, debts, groupOrder, setGroupOrder } = useDebts();
  const { colors: t } = useTheme();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const reconciledOrder = useMemo(() => {
    const valid = new Set(groups.map(g => g.id));
    const ordered = groupOrder.filter(id => valid.has(id));
    const missing = groups.filter(g => !ordered.includes(g.id)).map(g => g.id);
    return [...ordered, ...missing];
  }, [groupOrder, groups]);

  useEffect(() => {
    if (reconciledOrder.join(",") !== groupOrder.join(",")) {
      setGroupOrder(reconciledOrder);
    }
  }, [reconciledOrder.join(",")]);

  const displayItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (sort === "manual") {
      const items = reconciledOrder
        .map(id => groups.find(g => g.id === id))
        .filter((x): x is Group => !!x);
      return q ? items.filter(g =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        g.members.some(m => m.name.toLowerCase().includes(q))
      ) : items;
    }

    const filtered = groups.filter(g =>
      !q || g.name.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q) ||
      g.members.some(m => m.name.toLowerCase().includes(q))
    );

    return [...filtered].sort((a, b) => {
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
  }, [groups, debts, search, sort, reconciledOrder]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Group>) => {
    const total = calcGroupTotal(item.id, debts);
    const totalLabel = total === 0 ? "$0.00"
      : total > 0 ? `+$${total.toFixed(2)}` : `-$${Math.abs(total).toFixed(2)}`;
    const totalColor = total > 0 ? t.green : total < 0 ? t.red : t.textSub;

    return (
      <ScaleDecorator activeScale={1.02}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: isActive ? t.primarySoft : t.card, borderColor: isActive ? t.primaryBorder : t.border },
          ]}
          onPress={() => router.push(`/group/${item.id}` as any)}
          onLongPress={drag}
          delayLongPress={250}
        >
          <View style={styles.cardInner}>
            <View style={styles.dragHandle}>
              <Text style={[styles.dragIcon, { color: t.textMuted }]}>☰</Text>
            </View>
            <Avatar name={item.name} imageUri={item.imageUri} size={44} />
            <View style={styles.cardText}>
              <Text style={[styles.cardName, { color: t.text }]}>{item.name}</Text>
              <Text style={[styles.cardMeta, { color: t.textSub }]}>
                {item.members.length} {item.members.length === 1 ? "member" : "members"}
              </Text>
              {item.description ? <Text style={[styles.cardDesc, { color: t.textMuted }]}>{item.description}</Text> : null}
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.cardTotal, { color: totalColor }]}>{totalLabel}</Text>
              <Text style={[styles.chevron, { color: t.border }]}>›</Text>
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    );
  }, [debts, router, t]);

  const listHeader = (
    <View>
      <Text style={[styles.title, { color: t.text }]}>Groups</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Trip, event, and friend groups will appear here.</Text>
      <Pressable style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={() => router.push("/create-group")}>
        <Text style={styles.addBtnText}>+ Create Group</Text>
      </Pressable>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Search groups..."
          placeholderTextColor={t.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable
          style={[styles.sortBtn, {
            backgroundColor: sort !== "date" ? t.primarySoft : t.card,
            borderColor: sort !== "date" ? t.primaryBorder : t.border,
          }]}
          onPress={() => setShowSortMenu(true)}
        >
          <Text style={[styles.sortBtnIcon, { color: sort !== "date" ? t.primary : t.text }]}>⇅</Text>
        </Pressable>
      </View>
      {sort !== "date" && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}
      <Text style={[styles.dragHint, { color: t.textMuted }]}>Long-press any card to drag and reorder</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <DraggableFlatList
        data={displayItems}
        keyExtractor={(item: Group) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }: { data: Group[] }) => {
          const newOrder = data.map((g: Group) => g.id);
          if (search) {
            const filteredIds = new Set(newOrder);
            const rest = reconciledOrder.filter(id => !filteredIds.has(id));
            setGroupOrder([...newOrder, ...rest]);
          } else {
            setGroupOrder(newOrder);
          }
          setSort("manual");
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              {groups.length === 0 ? "No groups yet." : "No results found."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.menuTitle, { color: t.textMuted }]}>Sort By</Text>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.menuRow, sort === opt.value && { backgroundColor: t.primarySoft }]}
                onPress={() => { setSort(opt.value); setShowSortMenu(false); }}
              >
                <Text style={[styles.menuRowText, { color: sort === opt.value ? t.primary : t.text }]}>{opt.label}</Text>
                {sort === opt.value && <Text style={[styles.menuCheck, { color: t.primary }]}>✓</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 60 },
  subtitle: { fontSize: 16, marginTop: 8, marginBottom: 24 },
  addBtn: { padding: 18, borderRadius: 16, alignItems: "center" },
  addBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  searchInput: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sortBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 18 },
  sortHint: { fontSize: 12, marginTop: 6, marginLeft: 2 },
  dragHint: { fontSize: 11, marginTop: 4, marginLeft: 2, marginBottom: 16 },
  empty: { marginTop: 48, alignItems: "center" },
  emptyText: { fontSize: 16 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  dragHandle: { paddingHorizontal: 2 },
  dragIcon: { fontSize: 16 },
  cardText: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardMeta: { fontSize: 13, marginTop: 1 },
  cardDesc: { fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 2 },
  cardTotal: { fontSize: 15, fontWeight: "700" },
  chevron: { fontSize: 20 },
  balanceBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});

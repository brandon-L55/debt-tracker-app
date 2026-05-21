import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useFocusEffect, useRouter } from "expo-router";
// @ts-ignore — forwardRef deprecation hint from React 19; library still works correctly
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import type { Individual, Debt } from "@/context/DebtContext";

// "custom" = post-drag order; not shown in the sort menu
type SortOption = "az" | "za" | "latest-debt" | "owed-to-me-high" | "owed-to-them-high" | "owed-to-me-low" | "owed-to-them-low" | "custom";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "Alphabetical" },
  { value: "za", label: "Reverse Alphabetical" },
  { value: "latest-debt", label: "Latest debt" },
  { value: "owed-to-me-high", label: "Highest owed to me" },
  { value: "owed-to-them-high", label: "Highest owed to them" },
  { value: "owed-to-me-low", label: "Lowest owed to me" },
  { value: "owed-to-them-low", label: "Lowest owed to them" },
];

function calcNetBalance(name: string, debts: Debt[]): number {
  return debts.filter(d => d.person === name)
    .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
}

function calcOwedToMe(name: string, debts: Debt[]): number {
  return debts.filter(d => d.person === name && d.direction === "them")
    .reduce((s, d) => s + d.amount, 0);
}

function calcOwedToThem(name: string, debts: Debt[]): number {
  return debts.filter(d => d.person === name && d.direction === "me")
    .reduce((s, d) => s + d.amount, 0);
}

function latestDebtDate(name: string, debts: Debt[]): number {
  const matches = debts.filter(d => d.person === name);
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(d => new Date(d.createdAt).getTime()));
}

export default function IndividualsScreen() {
  const router = useRouter();
  const { individuals, debts, individualOrder, setIndividualOrder, updateIndividual, deleteIndividual } = useDebts();
  const { colors: t } = useTheme();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("latest-debt");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const swipeableRefs = useRef<Map<string, { current: any }>>(new Map());
  const openIdRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (openIdRef.current) {
          swipeableRefs.current.get(openIdRef.current)?.current?.close();
          openIdRef.current = null;
        }
      };
    }, [])
  );

  const reconciledOrder = useMemo(() => {
    const valid = new Set(individuals.map(i => i.id));
    const ordered = individualOrder.filter(id => valid.has(id));
    const missing = individuals.filter(i => !ordered.includes(i.id)).map(i => i.id);
    return [...ordered, ...missing];
  }, [individualOrder, individuals]);

  useEffect(() => {
    if (reconciledOrder.join(",") !== individualOrder.join(",")) {
      setIndividualOrder(reconciledOrder);
    }
  }, [reconciledOrder.join(",")]);

  const displayItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (sort === "custom") {
      const items = reconciledOrder
        .map(id => individuals.find(i => i.id === id))
        .filter((x): x is Individual => !!x);
      const filtered2 = q ? items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q) ||
        (p.phoneOrUsername ?? "").toLowerCase().includes(q) ||
        (p.notes ?? "").toLowerCase().includes(q)
      ) : items;
      return [...filtered2.filter(i => i.pinned), ...filtered2.filter(i => !i.pinned)];
    }

    const filtered = individuals.filter(p =>
      !q || p.name.toLowerCase().includes(q) ||
      (p.nickname ?? "").toLowerCase().includes(q) ||
      (p.phoneOrUsername ?? "").toLowerCase().includes(q) ||
      (p.notes ?? "").toLowerCase().includes(q)
    );

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "az": return (a.nickname || a.name).localeCompare(b.nickname || b.name);
        case "za": return (b.nickname || b.name).localeCompare(a.nickname || a.name);
        case "latest-debt": return latestDebtDate(b.name, debts) - latestDebtDate(a.name, debts);
        case "owed-to-me-high": return calcOwedToMe(b.name, debts) - calcOwedToMe(a.name, debts);
        case "owed-to-them-high": return calcOwedToThem(b.name, debts) - calcOwedToThem(a.name, debts);
        case "owed-to-me-low": return calcOwedToMe(a.name, debts) - calcOwedToMe(b.name, debts);
        case "owed-to-them-low": return calcOwedToThem(a.name, debts) - calcOwedToThem(b.name, debts);
        default: return 0;
      }
    });
    return [...sorted.filter(i => i.pinned), ...sorted.filter(i => !i.pinned)];
  }, [individuals, debts, search, sort, reconciledOrder]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Individual>) => {
    const balance = calcNetBalance(item.name, debts);
    const balanceLabel = balance === 0 ? "$0.00"
      : balance > 0 ? `+$${balance.toFixed(2)}` : `-$${Math.abs(balance).toFixed(2)}`;
    const balanceColor = balance > 0 ? t.green : balance < 0 ? t.red : t.textSub;

    function renderRightActions() {
      return (
        <View style={styles.swipeActions}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: t.border }]}
            onPress={() => updateIndividual(item.id, { silenced: !item.silenced })}
          >
            <Text style={styles.swipeActionIcon}>{item.silenced ? "🔔" : "🔕"}</Text>
          </Pressable>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: t.primarySoft }]}
            onPress={() => updateIndividual(item.id, { pinned: !item.pinned })}
          >
            <Text style={styles.swipeActionIcon}>{item.pinned ? "📌" : "📍"}</Text>
          </Pressable>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: t.redSoft }]}
            onPress={() =>
              Alert.alert(
                "Delete Individual",
                `Are you sure you want to delete ${item.name}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteIndividual(item.id) },
                ]
              )
            }
          >
            <Text style={styles.swipeActionIcon}>🗑️</Text>
          </Pressable>
        </View>
      );
    }

    if (!swipeableRefs.current.has(item.id)) {
      swipeableRefs.current.set(item.id, { current: null });
    }
    const itemRef = swipeableRefs.current.get(item.id)!;

    return (
      <ScaleDecorator activeScale={1.02}>
        <ReanimatedSwipeable
          friction={1.5}
          rightThreshold={30}
          overshootRight={false}
          renderRightActions={renderRightActions}
          ref={itemRef}
          onSwipeableOpen={() => {
            if (openIdRef.current && openIdRef.current !== item.id) {
              swipeableRefs.current.get(openIdRef.current)?.current?.close();
            }
            openIdRef.current = item.id;
          }}
          onSwipeableClose={() => {
            if (openIdRef.current === item.id) openIdRef.current = null;
          }}
        >
          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: isActive ? t.primarySoft : t.card, borderColor: isActive ? t.primaryBorder : t.border },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(`/individual/${item.id}` as any)}
            onLongPress={drag}
            delayLongPress={250}
            disabled={isActive}
          >
            <View style={styles.cardInner}>
              <View style={styles.dragHandle}>
                <Text style={[styles.dragIcon, { color: t.textMuted }]}>☰</Text>
              </View>
              <Avatar name={item.name} imageUri={item.imageUri} size={44} />
              <View style={styles.cardText}>
                <View style={styles.cardNameRow}>
                  <Text style={[styles.cardName, { color: t.text }]}>{item.name}</Text>
                  {item.pinned ? <Text style={styles.cardBadge}>📌</Text> : null}
                  {item.silenced ? <Text style={styles.cardBadge}>🔇</Text> : null}
                </View>
                {item.nickname ? <Text style={[styles.cardNickname, { color: t.textSub }]}>"{item.nickname}"</Text> : null}
                {item.phoneOrUsername ? <Text style={[styles.cardMeta, { color: t.textMuted }]}>{item.phoneOrUsername}</Text> : null}
                {item.notes ? <Text style={[styles.cardNotes, { color: t.textMuted }]}>{item.notes}</Text> : null}
              </View>
              <View style={[styles.balanceBadge, { borderColor: balanceColor + "44" }]}>
                <Text style={[styles.balanceText, { color: balanceColor }]}>{balanceLabel}</Text>
              </View>
            </View>
          </Pressable>
        </ReanimatedSwipeable>
      </ScaleDecorator>
    );
  }, [debts, router, t, updateIndividual, deleteIndividual]);

  const listHeader = (
    <View>
      <Text style={[styles.title, { color: t.text }]}>Individuals</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Manually added people will appear here.</Text>
      <Pressable style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={() => router.push("/add-individual")}>
        <Text style={styles.addBtnText}>+ Add Individual</Text>
      </Pressable>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Search individuals..."
          placeholderTextColor={t.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable
          style={[styles.sortBtn, {
            backgroundColor: (sort !== "latest-debt" && sort !== "custom") ? t.primarySoft : t.card,
            borderColor: (sort !== "latest-debt" && sort !== "custom") ? t.primaryBorder : t.border,
          }]}
          onPress={() => setShowSortMenu(true)}
        >
          <Text style={[styles.sortBtnIcon, { color: (sort !== "latest-debt" && sort !== "custom") ? t.primary : t.text }]}>⇅</Text>
        </Pressable>
      </View>
      {(sort !== "latest-debt" && sort !== "custom") && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}
      <Text style={[styles.dragHint, { color: t.textMuted }]}>Long-press any card (three lines on left) to drag and reorder</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <DraggableFlatList
        data={displayItems}
        keyExtractor={(item: Individual) => item.id}
        renderItem={renderItem}
        onDragEnd={({ data }: { data: Individual[] }) => {
          const newOrder = data.map((i: Individual) => i.id);
          if (search) {
            const filteredIds = new Set(newOrder);
            const rest = reconciledOrder.filter(id => !filteredIds.has(id));
            setIndividualOrder([...newOrder, ...rest]);
          } else {
            setIndividualOrder(newOrder);
          }
          setSort("custom");
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              {individuals.length === 0 ? "No individuals yet." : "No results found."}
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
  cardNickname: { fontSize: 13, marginTop: 1 },
  cardMeta: { fontSize: 13, marginTop: 1 },
  cardNotes: { fontSize: 12, fontStyle: "italic", marginTop: 2 },
  balanceBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  balanceText: { fontSize: 14, fontWeight: "700" },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardBadge: { fontSize: 12 },
  swipeActions: { flexDirection: "row" },
  swipeAction: { width: 54, justifyContent: "center", alignItems: "center" },
  swipeActionIcon: { fontSize: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});

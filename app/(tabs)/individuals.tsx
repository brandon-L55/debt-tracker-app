import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useFocusEffect, useRouter } from "expo-router";
// @ts-ignore — forwardRef deprecation hint from React 19; library still works correctly
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { useDebts } from "@/context/DebtContext";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { GradientButton } from "@/components/GradientButton";
import type { Individual, Debt } from "@/context/DebtContext";

type SortOption = "az" | "za" | "latest-debt" | "owed-to-me" | "owed-to-them" | "custom";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "az", label: "Alphabetical" },
  { value: "za", label: "Reverse Alphabetical" },
  { value: "latest-debt", label: "Latest Debt" },
  { value: "owed-to-me", label: "Highest Owed to Me" },
  { value: "owed-to-them", label: "Highest Owed to Them" },
];

function calcNetBalance(name: string, debts: Debt[]): number {
  return debts
    .filter(d => d.person === name && (d.status === "accepted" || d.status === "partial"))
    .reduce((s, d) => s + (d.direction === "them" ? d.remainingAmount : -d.remainingAmount), 0);
}

function latestDebtDate(name: string, debts: Debt[]): number {
  const matches = debts.filter(d => d.person === name);
  if (matches.length === 0) return 0;
  return Math.max(...matches.map(d => new Date(d.createdAt).getTime()));
}

export default function IndividualsScreen() {
  const router = useRouter();
  const { individuals, individualOrder, setIndividualOrder, updateIndividual, deleteIndividual, isLoading: contactsLoading, contactsError } = useContacts();
  const { debts } = useDebts();
  const { colors: t, isDark } = useTheme();
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
        case "owed-to-me": return calcNetBalance(b.name, debts) - calcNetBalance(a.name, debts);
        case "owed-to-them": return calcNetBalance(a.name, debts) - calcNetBalance(b.name, debts);
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
    const balanceColor = balance > 0 ? t.green : balance < 0 ? t.red : t.textMuted;

    function renderRightActions() {
      return (
        <View style={styles.swipeActions}>
          <Pressable
            style={[styles.swipeAction, { backgroundColor: t.elevatedCard }]}
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
              {
                backgroundColor: isActive ? t.primarySoft : t.card,
                borderColor: isActive ? t.primaryBorder : t.border,
                ...(isDark ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 } : {}),
              },
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
              <View style={[styles.balanceBadge, {
                backgroundColor: balance === 0 ? "transparent" : (balance > 0 ? t.greenSoft : t.redSoft),
                borderColor: balance === 0 ? t.border : (balance > 0 ? t.greenBorder : t.redBorder),
              }]}>
                <Text style={[styles.balanceText, { color: balanceColor }]}>{balanceLabel}</Text>
              </View>
            </View>
          </Pressable>
        </ReanimatedSwipeable>
      </ScaleDecorator>
    );
  }, [debts, router, t, isDark, updateIndividual, deleteIndividual]);

  const listHeader = (
    <View>
      <Text style={[styles.title, { color: t.text }]}>Individuals</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Manually added people will appear here.</Text>
      <GradientButton
        label="+ Add Individual"
        onPress={() => router.push("/add-individual")}
        style={{ marginBottom: 16 }}
      />
      <View style={[styles.searchRow]}>
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
          <Text style={[styles.sortBtnIcon, { color: (sort !== "latest-debt" && sort !== "custom") ? t.primary : t.textSub }]}>⇅</Text>
        </Pressable>
      </View>
      {(sort !== "latest-debt" && sort !== "custom") && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}
      <Text style={[styles.dragHint, { color: t.textMuted }]}>Long-press any card to drag and reorder</Text>
    </View>
  );

  if (contactsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (contactsError) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: t.red, fontSize: 15, textAlign: "center" }}>
          Failed to load contacts.{"\n"}{contactsError}
        </Text>
      </View>
    );
  }

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
            <View style={[styles.emptyIconCircle, {
              backgroundColor: isDark ? "#1C1040" : "#F3EFFF",
              borderColor: isDark ? "#3D2A7A" : "#DDD6FE",
              ...(isDark
                ? { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 22 }
                : { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 14 }),
            }]}>
              <Text style={styles.emptyIcon}>👥</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: t.text }]}>
              {individuals.length === 0 ? "No individuals yet." : "No results found."}
            </Text>
            <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
              {individuals.length === 0 ? "Add someone you share debts with." : "Try a different search."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.elevatedCard, borderColor: t.border, borderWidth: 1 }]} onPress={e => e.stopPropagation()}>
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
  title: { fontSize: 32, fontWeight: "800", marginTop: 60, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 20 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  sortBtn: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 18 },
  sortHint: { fontSize: 12, marginTop: 6, marginLeft: 2 },
  dragHint: { fontSize: 11, marginTop: 4, marginLeft: 2, marginBottom: 16 },
  empty: { marginTop: 48, alignItems: "center", gap: 10 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14 },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  cardInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  dragHandle: { paddingHorizontal: 2 },
  dragIcon: { fontSize: 16 },
  cardText: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: "700" },
  cardNickname: { fontSize: 13, marginTop: 1 },
  cardMeta: { fontSize: 13, marginTop: 1 },
  cardNotes: { fontSize: 12, fontStyle: "italic", marginTop: 2 },
  balanceBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  balanceText: { fontSize: 13, fontWeight: "700" },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardBadge: { fontSize: 12 },
  swipeActions: { flexDirection: "row" },
  swipeAction: { width: 54, justifyContent: "center", alignItems: "center" },
  swipeActionIcon: { fontSize: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 22, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  menuTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 12 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});

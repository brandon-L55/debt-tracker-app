import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useGroups } from "@/context/GroupsContext";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { GradientButton } from "@/components/GradientButton";
import { Avatar } from "@/components/Avatar";
import type { GroupMember } from "@/context/DebtContext";

export default function CreateGroupScreen() {
  const router = useRouter();
  const { addGroup } = useGroups();
  const { individuals } = useContacts();
  const { colors: t } = useTheme();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [saving, setSaving] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberContact, setMemberContact] = useState("");
  const [memberContactId, setMemberContactId] = useState<string | null>(null);

  const memberSuggestions = useMemo(() => {
    const q = memberName.trim().toLowerCase();
    if (!q || memberContactId) return [];
    const addedContactIds = new Set(members.map(m => m.contactId).filter(Boolean));
    return individuals
      .filter(ind => {
        if (addedContactIds.has(ind.id)) return false;
        const display = (ind.nickname || ind.name).toLowerCase();
        const pou = (ind.phoneOrUsername || "").toLowerCase();
        return display.includes(q) || ind.name.toLowerCase().includes(q) || pou.includes(q);
      })
      .slice(0, 5);
  }, [memberName, individuals, members, memberContactId]);

  function selectMemberSuggestion(ind: typeof individuals[0]) {
    setMemberName(ind.nickname || ind.name);
    setMemberContact(ind.phoneOrUsername || "");
    setMemberContactId(ind.id);
  }

  function handleAddMember() {
    if (!memberName.trim()) {
      Alert.alert("Missing field", "Enter a name.");
      return;
    }
    if (!memberContactId && !memberContact.trim()) {
      Alert.alert("Missing field", "Enter a phone number or username, or pick from your contacts.");
      return;
    }
    const contact = memberContactId ? individuals.find(i => i.id === memberContactId) : null;
    setMembers(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: memberName.trim(),
        phoneOrUsername: contact?.phoneOrUsername || memberContact.trim(),
        contactId: memberContactId ?? undefined,
      },
    ]);
    setMemberName("");
    setMemberContact("");
    setMemberContactId(null);
  }

  function handleRemoveMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  async function handleSave() {
    if (!groupName.trim()) {
      Alert.alert("Missing field", "Please enter a group name.");
      return;
    }
    setSaving(true);
    try {
      await addGroup({
        name: groupName.trim(),
        description: description.trim(),
        members,
      });
      router.replace("/(tabs)/groups");
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ?? "Could not save group.";
      console.error("CREATE GROUP ERROR:", e);
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 20}>
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 260 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: t.text }]}>Create Group</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>Organize debts for a trip, event, or friend group.</Text>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Group name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="e.g. Cabo Trip, Apartment, Dinner Club"
            placeholderTextColor={t.textMuted}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="What is this group for?"
            placeholderTextColor={t.textMuted}
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Members</Text>

          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text, marginBottom: 8 }]}
            placeholder="Name"
            placeholderTextColor={t.textMuted}
            value={memberName}
            onChangeText={text => { setMemberName(text); setMemberContactId(null); }}
          />
          {memberSuggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: t.card, borderColor: t.border }]}>
              {memberSuggestions.map(ind => {
                const displayName = ind.nickname || ind.name;
                return (
                  <Pressable
                    key={ind.id}
                    style={[styles.suggestionRow, { borderBottomColor: t.border }]}
                    onPress={() => selectMemberSuggestion(ind)}
                  >
                    <Avatar name={displayName} imageUri={ind.imageUri} size={32} />
                    <View style={styles.suggestionText}>
                      <Text style={[styles.suggestionName, { color: t.text }]}>{displayName}</Text>
                      {ind.nickname ? (
                        <Text style={[styles.suggestionSub, { color: t.textMuted }]}>{ind.name}</Text>
                      ) : ind.phoneOrUsername ? (
                        <Text style={[styles.suggestionSub, { color: t.textMuted }]}>{ind.phoneOrUsername}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <TextInput
            style={[styles.input, { backgroundColor: memberContactId ? t.input : t.input, borderColor: t.border, color: t.text, marginBottom: 8, opacity: memberContactId ? 0.5 : 1 }]}
            placeholder={memberContactId ? "Contact selected" : "Phone or @username"}
            placeholderTextColor={t.textMuted}
            value={memberContact}
            onChangeText={setMemberContact}
            autoCapitalize="none"
            editable={!memberContactId}
          />
          <Pressable style={[styles.addMemberButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={handleAddMember}>
            <Text style={[styles.addMemberText, { color: t.primary }]}>+ Add Member</Text>
          </Pressable>

          {members.length > 0 && (
            <View style={styles.memberList}>
              {members.map(m => {
                const contact = m.contactId ? individuals.find(i => i.id === m.contactId) : null;
                const displayName = contact?.nickname || m.name;
                return (
                  <View key={m.id} style={[styles.memberRow, { backgroundColor: t.card, borderColor: t.border }]}>
                    <View>
                      <Text style={[styles.memberName, { color: t.text }]}>{displayName}</Text>
                      {m.phoneOrUsername ? <Text style={[styles.memberContact, { color: t.textSub }]}>{m.phoneOrUsername}</Text> : null}
                    </View>
                    <Pressable onPress={() => handleRemoveMember(m.id)}>
                      <Text style={[styles.removeText, { color: t.red }]}>Remove</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <GradientButton
          label={saving ? "Saving…" : "Save Group"}
          onPress={handleSave}
          disabled={saving}
          style={{ marginTop: 10, marginBottom: 40 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 32, fontWeight: "800", marginTop: 40, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 28, marginTop: 6 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  addMemberButton: { borderWidth: 1, padding: 14, borderRadius: 16, alignItems: "center" },
  addMemberText: { fontSize: 15, fontWeight: "700" },
  memberList: { marginTop: 14, gap: 8 },
  memberRow: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  memberName: { fontSize: 15, fontWeight: "600" },
  memberContact: { fontSize: 13, marginTop: 2 },
  removeText: { fontSize: 14, fontWeight: "600" },
  suggestions: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: "hidden" },
  suggestionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  suggestionText: { flex: 1 },
  suggestionName: { fontSize: 15, fontWeight: "600" },
  suggestionSub: { fontSize: 13, marginTop: 1 },
});

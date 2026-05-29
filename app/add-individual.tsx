import { useState } from "react";
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useContacts } from "@/context/ContactsContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { GradientButton } from "@/components/GradientButton";
import { searchProfiles, type ProfileSearchResult } from "@/lib/services/contactsService";

function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/^@/, "");
}

type Phase = "search" | "found" | "not_found" | "manual";

function looksLikeEmail(q: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim());
}

function looksLikePhone(q: string) {
  return /^[+\d][\d\s\-\(\)\.]*$/.test(q.trim()) && !looksLikeEmail(q);
}

export default function AddIndividualScreen() {
  const router = useRouter();
  const { addLinkedIndividual, addIndividual, individuals } = useContacts();
  const { session } = useAuth();
  const { colors: t, isDark } = useTheme();

  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ProfileSearchResult | null>(null);

  // Shared form fields for confirm phases
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [notes, setNotes] = useState("");
  // Manual phase only
  const [manualPhone, setManualPhone] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);

  function resetToSearch() {
    setPhase("search");
    setSearchResult(null);
    setName("");
    setNickname("");
    setNotes("");
  }

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;

    // Early duplicate check against already-loaded contacts (avoids unnecessary DB write).
    const nq = normalizeQuery(q);
    const alreadyExists = individuals.some(ind =>
      normalizeQuery(ind.phoneOrUsername) === nq ||
      normalizeQuery(ind.name) === nq
    );
    if (alreadyExists) {
      Alert.alert("Already in contacts", "This person is already in your contacts.");
      return;
    }

    setSearching(true);
    try {
      const result = await searchProfiles(q);
      if (result?.id === session?.user.id) {
        Alert.alert("That's you!", "You can't add yourself as a contact.");
        return;
      }
      if (result) {
        setSearchResult(result);
        setName(result.display_name ?? "");
        setPhase("found");
      } else {
        setSearchResult(null);
        setName("");
        setPhase("not_found");
      }
    } catch (e: unknown) {
      Alert.alert("Search failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddLinked() {
    if (!searchResult) return;
    const displayLabel = searchResult.display_name ?? searchResult.username ?? "this person";
    const saveName = name.trim() || displayLabel;
    setSaving(true);
    try {
      const existed = await addLinkedIndividual({
        name: saveName,
        nickname: nickname.trim() || undefined,
        notes: notes.trim() || undefined,
        linkedUserId: searchResult.id,
        username: searchResult.username ?? undefined,
        phone: searchResult.phone ?? undefined,
        email: searchResult.email ?? undefined,
        avatarUrl: searchResult.avatar_url ?? undefined,
        inviteStatus: null,
      });
      if (existed) {
        Alert.alert("Already in contacts", "This person is already in your contacts.");
        return;
      }
      router.replace("/(tabs)/individuals");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUnlinked() {
    const n = name.trim();
    if (!n) {
      Alert.alert("Name required", "Please enter a name for this contact.");
      return;
    }
    const q = query.trim();
    const isEmail = looksLikeEmail(q);
    const isPhone = !isEmail && looksLikePhone(q);
    setSaving(true);
    try {
      const existed = await addLinkedIndividual({
        name: n,
        nickname: nickname.trim() || undefined,
        notes: notes.trim() || undefined,
        linkedUserId: null,
        email: isEmail ? q.toLowerCase() : undefined,
        phone: isPhone ? q : undefined,
        username: !isEmail && !isPhone ? q.replace(/^@/, "") : undefined,
        inviteStatus: isEmail ? "pending" : null,
        invitedEmail: isEmail ? q.toLowerCase() : null,
      });
      if (existed) {
        Alert.alert("Already in contacts", "This person is already in your contacts.");
        return;
      }
      router.replace("/(tabs)/individuals");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function handleManualSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a name.");
      return;
    }
    setSaving(true);
    try {
      const existed = await addIndividual({
        name: name.trim(),
        nickname: nickname.trim(),
        phoneOrUsername: manualPhone.trim(),
        notes: notes.trim(),
        imageUri: imageUri || undefined,
        pinned: false,
        silenced: false,
      });
      if (existed) {
        Alert.alert("Already in contacts", "This person is already in your contacts.");
        return;
      }
      router.replace("/(tabs)/individuals");
    } catch (e: unknown) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  // ─── SEARCH phase ─────────────────────────────────────────────────────────
  if (phase === "search") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: t.text }]}>Add Someone</Text>
          <Text style={[styles.subtitle, { color: t.textSub }]}>
            Find them by phone number, @username, or email.
          </Text>

          <View style={[styles.searchBox, { backgroundColor: t.input, borderColor: t.border }]}>
            <TextInput
              style={[styles.searchInput, { color: t.text }]}
              placeholder="+1 555-000-0000  ·  @username  ·  email"
              placeholderTextColor={t.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8} style={styles.clearBtn}>
                <Text style={[styles.clearX, { color: t.textMuted }]}>×</Text>
              </Pressable>
            )}
          </View>

          <GradientButton
            label={searching ? "Searching…" : "Search"}
            onPress={handleSearch}
            disabled={!query.trim() || searching}
            style={{ marginTop: 14 }}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
            <Text style={[styles.dividerLabel, { color: t.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
          </View>

          <Pressable
            onPress={() => { setPhase("manual"); setName(""); setManualPhone(""); setNickname(""); setNotes(""); setImageUri(""); }}
            style={styles.manualLinkWrap}
          >
            <Text style={[styles.manualLink, { color: t.primary }]}>Add manually without searching</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── FOUND phase ──────────────────────────────────────────────────────────
  if (phase === "found" && searchResult) {
    const displayLabel =
      searchResult.display_name ?? searchResult.username ?? searchResult.email ?? "Unknown";

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={resetToSearch} style={styles.backWrap}>
            <Text style={[styles.backText, { color: t.primary }]}>← Search again</Text>
          </Pressable>

          {/* Profile card */}
          <View style={[styles.profileCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.profileAvatarWrap}>
              {searchResult.avatar_url ? (
                <Image source={{ uri: searchResult.avatar_url }} style={styles.profileAvatar} />
              ) : (
                <Avatar name={displayLabel} size={72} />
              )}
            </View>
            <View style={[styles.onAppBadge, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}>
              <Text style={[styles.onAppBadgeText, { color: t.primary }]}>On Debt Tracker</Text>
            </View>
            <Text style={[styles.profileName, { color: t.text }]}>
              {searchResult.display_name ?? "No display name"}
            </Text>
            {searchResult.username ? (
              <Text style={[styles.profileHandle, { color: t.textSub }]}>@{searchResult.username}</Text>
            ) : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>Save as</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Name in your contacts"
              placeholderTextColor={t.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>
              Nickname{" "}
              <Text style={{ color: t.textMuted, fontWeight: "400" }}>(private, optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="What do you call them?"
              placeholderTextColor={t.textMuted}
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>
              Notes{" "}
              <Text style={{ color: t.textMuted, fontWeight: "400" }}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Any notes…"
              placeholderTextColor={t.textMuted}
              multiline
              scrollEnabled={false}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <GradientButton
            label={saving ? "Adding…" : `Add ${(name.trim() || displayLabel)}`}
            onPress={handleAddLinked}
            disabled={saving}
            style={{ marginTop: 8, marginBottom: 40 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── NOT FOUND phase ──────────────────────────────────────────────────────
  if (phase === "not_found") {
    const isEmailQuery = looksLikeEmail(query);

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.bg }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={resetToSearch} style={styles.backWrap}>
            <Text style={[styles.backText, { color: t.primary }]}>← Search again</Text>
          </Pressable>

          <View style={[styles.notFoundCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.notFoundHeading, { color: t.text }]}>No account found</Text>
            <Text style={[styles.notFoundQuery, { color: t.primary }]}>{query}</Text>
            <Text style={[styles.notFoundHint, { color: t.textSub }]}>
              {isEmailQuery
                ? "You can still add them. They'll link automatically when they join Debt Tracker."
                : "You can still add them as a contact."}
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="What do you call this person?"
              placeholderTextColor={t.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>
              Nickname{" "}
              <Text style={{ color: t.textMuted, fontWeight: "400" }}>(private, optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="A private label for this person"
              placeholderTextColor={t.textMuted}
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: t.text }]}>
              Notes{" "}
              <Text style={{ color: t.textMuted, fontWeight: "400" }}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Any notes…"
              placeholderTextColor={t.textMuted}
              multiline
              scrollEnabled={false}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <GradientButton
            label={saving ? "Adding…" : isEmailQuery ? "Add & Invite Later" : "Add Contact"}
            onPress={handleAddUnlinked}
            disabled={saving}
            style={{ marginTop: 8, marginBottom: 40 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── MANUAL phase ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={resetToSearch} style={styles.backWrap}>
          <Text style={[styles.backText, { color: t.primary }]}>← Back to search</Text>
        </Pressable>

        <Text style={[styles.title, { color: t.text }]}>Add Manually</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, {
            borderColor: isDark ? "#7C3AED" : "#C4B5FD",
            backgroundColor: isDark ? "#1C1040" : "#F3EFFF",
            ...(isDark
              ? { shadowColor: "#7C3AED", shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }
              : { shadowColor: "#7C3AED", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }),
          }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <Avatar name={name || "?"} size={80} />
            )}
          </View>
          <Pressable
            style={[styles.addPhotoBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
            onPress={pickImage}
          >
            <Text style={[styles.addPhotoText, { color: t.primary }]}>
              {imageUri ? "Change Photo" : "Add Photo"}
            </Text>
          </Pressable>
          {imageUri ? (
            <Pressable onPress={() => setImageUri("")}>
              <Text style={[styles.removePhoto, { color: t.textMuted }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Full name"
            placeholderTextColor={t.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Nickname</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="What do you call them?"
            placeholderTextColor={t.textMuted}
            value={nickname}
            onChangeText={setNickname}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Phone or username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="+1 555-000-0000 or @username"
            placeholderTextColor={t.textMuted}
            value={manualPhone}
            onChangeText={setManualPhone}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Any notes about this person..."
            placeholderTextColor={t.textMuted}
            multiline
            scrollEnabled={false}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <GradientButton
          label={saving ? "Saving…" : "Save Contact"}
          onPress={handleManualSave}
          disabled={saving}
          style={{ marginTop: 10, marginBottom: 40 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, paddingBottom: 60 },

  title: { fontSize: 32, fontWeight: "800", marginTop: 16, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 24 },

  // Search phase
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
  searchInput: { flex: 1, paddingVertical: 16, fontSize: 16 },
  clearBtn: { paddingLeft: 8 },
  clearX: { fontSize: 22, lineHeight: 26 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { fontSize: 13, fontWeight: "500" },
  manualLinkWrap: { alignItems: "center" },
  manualLink: { fontSize: 15, fontWeight: "600" },

  // Back link
  backWrap: { marginTop: 4, marginBottom: 20 },
  backText: { fontSize: 15, fontWeight: "600" },

  // Found phase
  profileCard: {
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: "center", gap: 6, marginBottom: 28,
  },
  profileAvatarWrap: { marginBottom: 4 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36 },
  onAppBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4,
  },
  onAppBadgeText: { fontSize: 12, fontWeight: "700" },
  profileName: { fontSize: 20, fontWeight: "700" },
  profileHandle: { fontSize: 14 },

  // Not found phase
  notFoundCard: {
    borderRadius: 20, borderWidth: 1, padding: 20,
    alignItems: "center", gap: 6, marginBottom: 28,
  },
  notFoundHeading: { fontSize: 17, fontWeight: "700" },
  notFoundQuery: { fontSize: 16, fontWeight: "600" },
  notFoundHint: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 2 },

  // Shared form
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 90, textAlignVertical: "top" },

  // Manual phase avatar
  avatarSection: { alignItems: "center", paddingVertical: 20, gap: 10 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  addPhotoBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  addPhotoText: { fontSize: 14, fontWeight: "600" },
  removePhoto: { fontSize: 13 },
});

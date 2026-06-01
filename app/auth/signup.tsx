import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { DoneBar } from "@/components/DoneBar";
import { GotchuLatrLogo } from "@/components/GotchuLatrLogo";
import { isPhoneNumber } from "@/lib/phoneUtils";

const ACCESSORY_ID = "auth-signup";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isValidUsername(s: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(s.trim().toLowerCase());
}

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { colors: t } = useTheme();

  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<"none" | "confirm_email" | "ready">("none");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError(null);
    const trimPhone = phone.trim();
    const trimUsername = username.trim();
    const trimEmail = email.trim().toLowerCase();

    if (!trimPhone) {
      setError("Please enter your phone number.");
      return;
    }
    if (!isPhoneNumber(trimPhone)) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (trimUsername && !isValidUsername(trimUsername)) {
      setError("Username must be 3–30 characters: letters, numbers, and underscores only.");
      return;
    }
    if (trimEmail && !isValidEmail(trimEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await signUp({
      phone: trimPhone,
      password,
      displayName: displayName.trim() || undefined,
      username: trimUsername || undefined,
      email: trimEmail || undefined,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.needsEmailConfirmation) {
      setSuccessState("confirm_email");
    } else {
      setSuccessState("ready");
    }
  }

  // ── Success: email confirmation needed ────────────────────
  if (successState === "confirm_email") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: t.bg }]}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={[styles.successTitle, { color: t.text }]}>Check your email</Text>
          <Text style={[styles.successBody, { color: t.textSub }]}>
            We sent a confirmation link to{"\n"}
            <Text style={{ color: t.text, fontWeight: "600" }}>{email.trim().toLowerCase()}</Text>
            {"\n\n"}Click the link to activate your account, then sign in.
          </Text>
          <Pressable onPress={() => router.replace("/auth/login")}>
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Success: phone-only (no email confirmation) ───────────
  if (successState === "ready") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: t.bg }]}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={[styles.successTitle, { color: t.text }]}>You're all set!</Text>
          <Text style={[styles.successBody, { color: t.textSub }]}>
            Your account has been created.{"\n"}
            Sign in with your phone number and password.
          </Text>
          <Pressable onPress={() => router.replace("/auth/login")}>
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Signup form ───────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.logoWrap}>
          <GotchuLatrLogo size={80} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>
          Start tracking debts in seconds.
        </Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>

          {/* Phone — required */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>
              Phone number <Text style={{ color: t.red }}>*</Text>
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="call-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={t.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                returnKeyType="next"
                inputAccessoryViewID={ACCESSORY_ID}
              />
            </View>
          </View>

          {/* Display Name — optional */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>
              Display name <Text style={[styles.optionalTag, { color: t.textMuted }]}>(optional)</Text>
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="person-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Your name"
                placeholderTextColor={t.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                inputAccessoryViewID={ACCESSORY_ID}
              />
            </View>
            <Text style={[styles.hint, { color: t.textMuted }]}>
              This is what others see when they find you
            </Text>
          </View>

          {/* Username — optional */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>
              Username <Text style={[styles.optionalTag, { color: t.textMuted }]}>(optional)</Text>
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="at-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="yourhandle"
                placeholderTextColor={t.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                inputAccessoryViewID={ACCESSORY_ID}
              />
            </View>
            <Text style={[styles.hint, { color: t.textMuted }]}>
              3–30 chars · letters, numbers, underscores
            </Text>
          </View>

          {/* Email — optional */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>
              Email <Text style={[styles.optionalTag, { color: t.textMuted }]}>(optional)</Text>
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="mail-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="you@example.com"
                placeholderTextColor={t.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                inputAccessoryViewID={ACCESSORY_ID}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={t.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                returnKeyType="next"
                inputAccessoryViewID={ACCESSORY_ID}
              />
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={t.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Confirm password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="••••••••"
                placeholderTextColor={t.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                textContentType="newPassword"
                returnKeyType="go"
                inputAccessoryViewID={ACCESSORY_ID}
                onSubmitEditing={handleSignup}
              />
              <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={10} style={styles.eyeBtn}>
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={t.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
              <Text style={[styles.errorText, { color: t.red }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable onPress={handleSignup} disabled={loading} style={loading ? { opacity: 0.6 } : undefined}>
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.textSub }]}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/auth/login")}>
            <Text style={[styles.footerLink, { color: t.primary }]}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DoneBar nativeID={ACCESSORY_ID} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  centerContainer: { flex: 1, justifyContent: "center", padding: 24 },
  logoWrap: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 28 },
  card: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  optionalTag: { fontSize: 11, fontWeight: "400" },
  hint: { fontSize: 11, marginTop: 2 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    gap: 8,
  },
  inputIconLeft: { flexShrink: 0 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  eyeBtn: { flexShrink: 0, paddingLeft: 4 },
  errorBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 14 },
  gradientBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: "700" },
  successIcon: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  successBody: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 4 },
});

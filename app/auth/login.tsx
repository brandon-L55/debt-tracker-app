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

const ACCESSORY_ID = "auth-login";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, resendConfirmationEmail } = useAuth();
  const { colors: t } = useTheme();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  async function handleResend() {
    if (!unconfirmedEmail) return;
    setResendState("idle");
    setResendError(null);
    setResendLoading(true);
    const err = await resendConfirmationEmail(unconfirmedEmail);
    setResendLoading(false);
    if (err) {
      setResendError(err);
      setResendState("error");
    } else {
      setResendState("sent");
    }
  }

  async function handleLogin() {
    setError(null);
    setUnconfirmedEmail(null);
    setResendState("idle");
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      setError("Please enter your username, email, or phone number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    const err = await signIn(trimmedIdentifier, password);
    setLoading(false);

    if (err) {
      if (err.startsWith("EMAIL_NOT_CONFIRMED:")) {
        const email = err.slice("EMAIL_NOT_CONFIRMED:".length);
        setUnconfirmedEmail(email);
        setError("Your email address hasn't been confirmed yet. Check your inbox or resend below.");
      } else {
        setError(err);
      }
    } else {
      router.replace("/(tabs)");
    }
  }

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
        {/* Logo */}
        <View style={styles.logoWrap}>
          <GotchuLatrLogo size={80} />
        </View>

        {/* Heading */}
        <Text style={[styles.title, { color: t.text }]}>Welcome</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>
          Sign in to your GotchuLatr account
        </Text>

        {/* Form card */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {/* Identifier */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Username, email, or phone number</Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="person-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="yourhandle, you@email.com, or +1 555…"
                placeholderTextColor={t.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                textContentType="username"
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
                placeholder="••••••••"
                placeholderTextColor={t.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="password"
                returnKeyType="go"
                inputAccessoryViewID={ACCESSORY_ID}
                onSubmitEditing={handleLogin}
              />
              <Pressable
                onPress={() => setShowPassword(v => !v)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={t.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
              <Text style={[styles.errorText, { color: t.red }]}>{error}</Text>
            </View>
          ) : null}

          {/* Resend confirmation — shown only when email is unconfirmed */}
          {unconfirmedEmail ? (
            <>
              {resendState === "sent" ? (
                <View style={[styles.infoBox, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
                  <Text style={[styles.infoText, { color: t.green }]}>Confirmation email resent. Check your inbox.</Text>
                </View>
              ) : null}
              {resendState === "error" && resendError ? (
                <View style={[styles.errorBox, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
                  <Text style={[styles.errorText, { color: t.red }]}>{resendError}</Text>
                </View>
              ) : null}
              <Pressable
                onPress={handleResend}
                disabled={resendLoading || resendState === "sent"}
                style={[styles.resendBtn, (resendLoading || resendState === "sent") ? { opacity: 0.5 } : undefined]}
              >
                {resendLoading ? (
                  <ActivityIndicator size="small" color={t.textSub} />
                ) : (
                  <Text style={[styles.resendText, { color: t.primary }]}>Resend confirmation email</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={loading ? { opacity: 0.6 } : undefined}
          >
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Forgot password */}
          <Pressable
            onPress={() => router.push("/auth/forgot-password")}
            style={styles.forgotBtn}
          >
            <Text style={[styles.forgotText, { color: t.textSub }]}>Forgot password?</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
          <Text style={[styles.dividerLabel, { color: t.textMuted }]}>OR CONTINUE WITH</Text>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialRow}>
          <Pressable style={[styles.socialBtn, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.socialText, { color: t.text }]}>Apple</Text>
          </Pressable>
          <Pressable style={[styles.socialBtn, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.socialText, { color: t.text }]}>Google</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.textSub }]}>
            Don{"'"}t have an account?{" "}
          </Text>
          <Pressable onPress={() => router.push("/auth/signup")}>
            <Text style={[styles.footerLink, { color: t.primary }]}>Sign up</Text>
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
  logoWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 28,
  },
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
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    gap: 8,
  },
  inputIconLeft: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  eyeBtn: {
    flexShrink: 0,
    paddingLeft: 4,
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
  },
  gradientBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  forgotBtn: {
    alignItems: "center",
    marginTop: -4,
  },
  forgotText: {
    fontSize: 14,
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  infoText: {
    fontSize: 14,
    textAlign: "center",
  },
  resendBtn: {
    alignItems: "center",
    paddingVertical: 4,
  },
  resendText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dividerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  socialRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  socialBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  socialText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});

import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function GradientButton({ label, onPress, disabled, style }: Props) {
  const { isDark } = useTheme();

  const glow = isDark
    ? { shadowColor: "#FF4ECD", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 12 }
    : { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 6 };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.wrapper, glow, style, disabled ? { opacity: 0.6 } : undefined]}
    >
      <LinearGradient
        colors={isDark ? ["#6D28D9", "#FF3EA5"] : ["#7C3AED", "#EC4899"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 20 },
  gradient: { padding: 18, borderRadius: 20, alignItems: "center" },
  text: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },
});

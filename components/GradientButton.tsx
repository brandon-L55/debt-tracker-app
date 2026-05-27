import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { glow } from "@/constants/effects";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function GradientButton({ label, onPress, disabled, style }: Props) {
  const { colors: t } = useTheme();
  const [pressed, setPressed] = useState(false);

  const shadow = pressed ? glow(t.from, "strong") : glow(t.from, "medium");

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.wrapper,
        shadow,
        style,
        disabled && { opacity: 0.5 },
        pressed && { transform: [{ translateY: -1 }] },
      ]}
    >
      <LinearGradient
        colors={[t.from, t.to] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 16 },
  gradient: { height: 52, paddingHorizontal: 18, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  text: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
});

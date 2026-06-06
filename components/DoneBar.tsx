import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

// Approximate iOS system keyboard toolbar colors.
// Using these instead of theme card colors prevents the visible white/blue gap
// between the Done bar and the keyboard body in both light and dark mode.
const IOS_KB_LIGHT = "#D1D3D9"; // matches the iOS light-mode keyboard toolbar
const IOS_KB_DARK  = "#1C1C1E"; // matches the iOS dark-mode keyboard toolbar
const IOS_BORDER_LIGHT = "rgba(0,0,0,0.18)";
const IOS_BORDER_DARK  = "rgba(255,255,255,0.10)";

/**
 * Renders an iOS InputAccessoryView "Done" bar above the keyboard for the
 * TextInput(s) that carry the matching inputAccessoryViewID prop.
 * Returns null on Android and web — no layout impact on those platforms.
 *
 * Background is set to the approximate iOS system keyboard toolbar color so
 * the bar visually blends with the keyboard edge in both light and dark mode.
 */
export function DoneBar({ nativeID }: { nativeID: string }) {
  const { colors: t, isDark } = useTheme();
  if (Platform.OS !== "ios") return null;
  const barBg     = isDark ? IOS_KB_DARK  : IOS_KB_LIGHT;
  const barBorder = isDark ? IOS_BORDER_DARK : IOS_BORDER_LIGHT;
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.bar, { backgroundColor: barBg, borderTopColor: barBorder }]}>
        <Pressable onPress={Keyboard.dismiss} hitSlop={8}>
          <Text style={[styles.done, { color: t.primary }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: { fontSize: 16, fontWeight: "600" },
});

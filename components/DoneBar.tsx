import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

/**
 * Renders an iOS InputAccessoryView "Done" bar above the keyboard for the
 * TextInput(s) that carry the matching inputAccessoryViewID prop.
 * Returns null on Android and web — no layout impact on those platforms.
 */
export function DoneBar({ nativeID }: { nativeID: string }) {
  const { colors: t } = useTheme();
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.bar, { backgroundColor: t.card, borderTopColor: t.border }]}>
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

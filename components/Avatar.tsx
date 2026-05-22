import { Image, StyleSheet, Text, View } from "react-native";

const PALETTE = ["#7C3AED", "#06D6A0", "#FF4ECD", "#FFD166", "#3B82F6", "#FF5A5F"];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

type Props = {
  name: string;
  imageUri?: string;
  size?: number;
};

export function Avatar({ name, imageUri, size = 48 }: Props) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const bg = colorFor(name);

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + "25", borderColor: bg + "60" },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36, color: bg }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  initials: {
    fontWeight: "800",
  },
});

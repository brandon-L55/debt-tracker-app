import { Image } from "react-native";
import type { StyleProp, ImageStyle } from "react-native";

const LOGO = require("../assets/images/gotchulatr-logo.png");

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function GotchuLatrLogo({ size = 80, style }: Props) {
  return (
    <Image
      source={LOGO}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}

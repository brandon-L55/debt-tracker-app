import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

// Brand gradient — violet-purple → magenta → pink → coral (135° diagonal)
const BRAND_GRADIENT = ["#8034DA", "#A636BE", "#E45089", "#F45E59"] as const;

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * GotchuLatr logo mark — white G arc + checkmark on the brand gradient.
 *
 * SVG design (100×100 viewBox, center 50 50, R=38):
 *   • G bowl : thick counterclockwise C-arc, opening ±40° on the right side
 *              M 79 26 A 38 38 0 1 0 79 74
 *   • Check  : ✓ centered in the opening — no separate crossbar
 */
export function GotchuLatrLogo({ size = 80, style }: Props) {
  const radius = Math.round(size * 0.22);
  const svgSize = size * 0.80;

  return (
    <LinearGradient
      colors={BRAND_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { width: size, height: size, borderRadius: radius, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Svg width={svgSize} height={svgSize} viewBox="0 0 100 100">
        {/* G bowl — thick arc (C shape), counterclockwise from upper-right to lower-right */}
        <Path
          d="M 79 26 A 38 38 0 1 0 79 74"
          stroke="white"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        {/* Checkmark — sits inside the G's right-side opening, no crossbar */}
        <Path
          d="M 57 50 L 65 61 L 77 43"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </LinearGradient>
  );
}

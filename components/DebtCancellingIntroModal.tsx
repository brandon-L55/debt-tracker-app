import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";

export const CANCELLING_INTRO_KEY_PREFIX = "@debt_tracker/cancelling_intro";

interface Props {
  visible: boolean;
  /** X button or "Not Now" — marks seen but does not expand the section */
  onClose: () => void;
  /** "Use Debt Simplifying" — marks seen and expands the section */
  onEnable: () => void;
}

// ─── Diagram geometry (280 × 220 SVG) ──────────────────────────────────────
//
// Node circle centers (radius 26, gap 28px from center to arrow start/end):
//   Alex   (140,  26) — top center
//   Sam    (248, 172) — bottom right
//   Jordan ( 32, 172) — bottom left
//   Centroid: (140, 123)
//
// Clockwise arrow cycle: Alex → Sam → Jordan → Alex
//
// Each control point = midpoint(P1, P2) + 40 × normalize(centroid → midpoint)
// This makes every arrow bow outward from the center by the same amount.
//
// Start = P1 + 28 × normalize(control − P1)   (leave from circle edge)
// End   = P2 + 28 × normalize(control − P2)   (arrive at circle edge)
//
// Arrowhead wings: 8px, ±140° from the forward tangent at the end point.
//
// Resulting paths (computed, symmetric left↔right about x=140):
//   A→S:  start(164,41)  ctrl(230,83)  end(243,145)
//   S→J:  start(222,182) ctrl(140,212) end(58,182)
//   J→A:  start(38,145)  ctrl(50,83)   end(116,41)
// ─────────────────────────────────────────────────────────────────────────────

const ARROW_AS = "M 164 41 Q 230 83 243 145 L 237 140 M 243 145 L 247 138";
const ARROW_SJ = "M 222 182 Q 140 212 58 182 L 66 179 M 58 182 L 62 189";
const ARROW_JA = "M 38 145 Q 50 83 116 41 L 114 49 M 116 41 L 108 40";

const SLIDE_H = 220;

function computeInitialPageWidth(): number {
  const screen = Dimensions.get("window").width;
  const cardWidth = Math.min(screen - 40, 400); // overlay padding 20px each side
  return cardWidth - 48; // card padding 24px each side
}

// ─── Person node ────────────────────────────────────────────────────────────

function PersonNode({ name, showCheck = false }: { name: string; showCheck?: boolean }) {
  const { colors: t } = useTheme();
  return (
    <View style={pn.wrap}>
      <View style={[pn.circle, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}>
        <Text style={[pn.initial, { color: t.primary }]}>{name[0]}</Text>
        {showCheck && (
          <View style={[pn.checkDot, { backgroundColor: t.green }]}>
            <Text style={pn.checkDotText}>✓</Text>
          </View>
        )}
      </View>
      <Text style={[pn.nameText, { color: t.text }]}>{name}</Text>
    </View>
  );
}

const pn = StyleSheet.create({
  wrap: { alignItems: "center", width: 64 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  initial: { fontSize: 20, fontWeight: "700" },
  checkDot: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  checkDotText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  nameText: { fontSize: 12, fontWeight: "600", marginTop: 5, textAlign: "center" },
});

// ─── Main modal ──────────────────────────────────────────────────────────────

export function DebtCancellingIntroModal({ visible, onClose, onEnable }: Props) {
  const { colors: t } = useTheme();
  const [slide, setSlide] = useState(0);
  const [pageWidth, setPageWidth] = useState(computeInitialPageWidth);

  const scrollRef = useRef<ScrollView>(null);
  // Tracks previous slide to distinguish initial open (prev=-1) from slide changes
  const prevSlideRef = useRef(-1);
  // Spring the centre ✓ in on slide 2
  const checkScale = useRef(new Animated.Value(0)).current;

  // Reset everything when modal opens or closes
  useEffect(() => {
    if (!visible) {
      prevSlideRef.current = -1;
      return;
    }
    setSlide(0);
    prevSlideRef.current = -1;
    checkScale.setValue(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [visible]);

  // Animate the centre ✓ on slide transitions
  useEffect(() => {
    if (!visible) return;
    const prev = prevSlideRef.current;
    prevSlideRef.current = slide;

    if (prev === -1) return; // initial modal open, already handled above

    if (slide === 1) {
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }).start();
    } else if (prev === 1) {
      // Swiped back to slide 1
      checkScale.setValue(0);
    }
  }, [slide, visible]);

  const goToSlide = (n: number) => {
    scrollRef.current?.scrollTo({ x: n * pageWidth, animated: true });
    setSlide(n);
  };

  const handleScrollEnd = (e: any) => {
    if (pageWidth <= 0) return;
    const newSlide = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (newSlide !== slide) setSlide(newSlide);
  };

  const handlePagerLayout = (e: any) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - pageWidth) > 1) setPageWidth(w);
  };

  // Slide 1: solid purple arrows. Slide 2: faded dashed arrows (debts cancelled).
  const arrowColor = slide === 0 ? t.primary : t.textMuted;
  const arrowDash = slide === 0 ? undefined : "6 4";
  const arrowOpacity = slide === 0 ? 1 : 0.45;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={m.overlay}>
        <View style={[m.card, { backgroundColor: t.card }]}>

          {/* ── X dismiss ────────────────────────────────────────────────── */}
          <Pressable
            style={[m.closeBtn, { backgroundColor: t.bg2, borderColor: t.border }]}
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close"
          >
            <Text style={[m.closeBtnText, { color: t.textMuted }]}>×</Text>
          </Pressable>

          {/* ── Triangle diagram (fixed across both slides) ───────────────── */}
          <View style={m.diag}>

            {/* Static SVG arrows — all three share the same stroke style */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width={280} height={220}>
                <Path
                  d={ARROW_AS}
                  stroke={arrowColor}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={arrowDash}
                  opacity={arrowOpacity}
                />
                <Path
                  d={ARROW_SJ}
                  stroke={arrowColor}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={arrowDash}
                  opacity={arrowOpacity}
                />
                <Path
                  d={ARROW_JA}
                  stroke={arrowColor}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={arrowDash}
                  opacity={arrowOpacity}
                />
              </Svg>

              {/* "owes $20" labels — positioned near each arrow's visual midpoint */}
              <Text style={[m.arrowLabel, { color: t.textSub, top: 56, right: 3 }]}>owes $20</Text>
              <Text style={[m.arrowLabel, { color: t.textSub, top: 201, left: 104 }]}>owes $20</Text>
              <Text style={[m.arrowLabel, { color: t.textSub, top: 74, left: 1 }]}>owes $20</Text>
            </View>

            {/* Person nodes (rendered on top of SVG) */}
            <View style={m.nodeTop}>
              <PersonNode name="Alex" showCheck={slide === 1} />
            </View>
            <View style={m.nodeBottom}>
              <PersonNode name="Jordan" />
              <PersonNode name="Sam" />
            </View>

            {/* Centre ✓ — springs in on slide 2 */}
            <Animated.View
              style={[
                m.centerCheck,
                { backgroundColor: t.green },
                { transform: [{ scale: checkScale }] },
              ]}
            >
              <Text style={m.centerCheckText}>✓</Text>
            </Animated.View>
          </View>

          {/* ── Horizontal pager (slide text content) ────────────────────── */}
          {/*
            onLayout gives the exact inner width so pagingEnabled snaps correctly.
            computeInitialPageWidth() seeds the first render to avoid a blank flash.
          */}
          <View onLayout={handlePagerLayout}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleScrollEnd}
              style={{ height: SLIDE_H }}
            >
              {/* ── Slide 1 ─────────────────────────────────────────────── */}
              <View style={{ width: pageWidth }}>
                <Text style={[m.title, { color: t.text }]}>
                  Group debts can cancel out
                </Text>
                <Text style={[m.body, { color: t.textSub }]}>
                  Sometimes everyone in a group owes someone else the same amount.
                  Instead of making everyone pay each other, GotchuLatr can show
                  you the simplest way to settle up.
                </Text>
              </View>

              {/* ── Slide 2 ─────────────────────────────────────────────── */}
              <View style={{ width: pageWidth }}>
                <Text style={[m.title, { color: t.text }]}>
                  Fewer payments. Less confusion.
                </Text>
                <Text style={[m.body, { color: t.textSub }]}>
                  GotchuLatr previews the fewest payments needed to settle up —
                  or shows no payments when debts cancel out completely.
                  No debts are changed until you take action.
                </Text>
                <View
                  style={[m.resultCard, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}
                >
                  <Text style={[m.resultTitle, { color: t.green }]}>Net result: $0 owed</Text>
                  <Text style={[m.resultSub, { color: t.green }]}>No payments needed</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* ── Page dots ────────────────────────────────────────────────── */}
          <View style={m.dots}>
            <View style={[m.dot, { backgroundColor: slide === 0 ? t.primary : t.border, width: slide === 0 ? 20 : 8 }]} />
            <View style={[m.dot, { backgroundColor: slide === 1 ? t.primary : t.border, width: slide === 1 ? 20 : 8 }]} />
          </View>

          {/* ── Action buttons ───────────────────────────────────────────── */}
          {slide === 0 ? (
            <Pressable
              style={[m.nextBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
              onPress={() => goToSlide(1)}
            >
              <Text style={[m.nextBtnText, { color: t.primary }]}>Next  →</Text>
            </Pressable>
          ) : (
            <View style={m.btnRow}>
              <Pressable style={[m.btnSecondary, { borderColor: t.border }]} onPress={onClose}>
                <Text style={[m.btnSecText, { color: t.textSub }]}>Not Now</Text>
              </Pressable>
              <Pressable style={m.btnPrimary} onPress={onEnable}>
                <LinearGradient
                  colors={[t.from, t.to] as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={m.btnGrad}
                >
                  <Text style={m.btnPrimText}>✨ Use Debt Simplifying</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    paddingTop: 32,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 24,
  },

  // X dismiss (absolute top-right)
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeBtnText: { fontSize: 20, lineHeight: 26, fontWeight: "300" },

  // Diagram container
  diag: {
    width: 280,
    height: 220,
    alignSelf: "center",
    marginBottom: 4,
  },

  // Node positioning inside diag (absolute)
  nodeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  nodeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // "owes $20" labels (absolute inside arrow View)
  arrowLabel: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "600",
  },

  // Centre ✓ (slide 2)
  centerCheck: {
    position: "absolute",
    top: 106,
    left: 124,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  centerCheckText: { fontSize: 16, color: "#fff", fontWeight: "700" },

  // Slide text
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 12,
  },

  // Result card (slide 2)
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  resultTitle: { fontSize: 15, fontWeight: "700" },
  resultSub: { fontSize: 13, marginTop: 2 },

  // Page dots
  dots: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  dot: { height: 8, borderRadius: 4 },

  // Slide-1 next button
  nextBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextBtnText: { fontSize: 15, fontWeight: "700" },

  // Slide-2 button row
  btnRow: { flexDirection: "row", gap: 10 },
  btnSecondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecText: { fontSize: 14, fontWeight: "600" },
  btnPrimary: { flex: 2, borderRadius: 14, overflow: "hidden" },
  btnGrad: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  btnPrimText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});

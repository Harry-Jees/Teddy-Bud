import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type AnimatedNavIconName = 'chat' | 'discover' | 'memories' | 'settings';

type Props = {
  name: AnimatedNavIconName;
  active: boolean;
  pulseKey: number;
  reduceMotion: boolean;
};

const COLORS = {
  ink: '#82766C',
  active: '#684D3B',
  clay: '#F0E1D4',
  peach: '#D9A987',
  paper: '#FFFDF9',
};

export function AnimatedNavIcon({ name, active, pulseKey, reduceMotion }: Props) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      speed: 20,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  useEffect(() => {
    if (reduceMotion) {
      press.setValue(1);
      sparkle.setValue(0);
      return;
    }
    press.setValue(0.88);
    Animated.sequence([
      Animated.spring(press, { toValue: 1.12, speed: 24, bounciness: 7, useNativeDriver: true }),
      Animated.spring(press, { toValue: 1, speed: 18, bounciness: 5, useNativeDriver: true }),
    ]).start();
    if (name === 'discover') {
      sparkle.setValue(0);
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [pulseKey, name, reduceMotion, press, sparkle]);

  const tint = progress.interpolate({ inputRange: [0, 1], outputRange: [COLORS.ink, COLORS.active] });
  const activeScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const activeFill = progress.interpolate({ inputRange: [0, 1], outputRange: ['0', '1'] });
  const strokeWidth = active ? 2.35 : 2;
  const icon = (() => {
    switch (name) {
      case 'chat':
        return <View style={styles.chatIcon}>
          <View style={[styles.chatBubble, { borderWidth: strokeWidth, borderColor: active ? COLORS.active : COLORS.ink }]} />
          <View style={[styles.chatTail, { borderColor: active ? COLORS.active : COLORS.ink }]} />
          <View style={styles.chatDots}><View style={[styles.chatDot, { backgroundColor: active ? COLORS.active : COLORS.ink }]} /><View style={[styles.chatDot, { backgroundColor: active ? COLORS.active : COLORS.ink }]} /><View style={[styles.chatDot, { backgroundColor: active ? COLORS.active : COLORS.ink }]} /></View>
        </View>;
      case 'discover':
        return <View style={styles.discoverIcon}>
          <View style={[styles.compassOuter, { borderColor: active ? COLORS.active : COLORS.ink }]} />
          <View style={[styles.compassNeedle, { borderBottomColor: active ? COLORS.active : COLORS.ink }]} />
          <Animated.View style={[styles.compassSpark, { opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }), rotate: '45deg' }] }]} />
        </View>;
      case 'memories':
        return <View style={styles.memoryIcon}>
          <View style={[styles.memoryBook, { borderColor: active ? COLORS.active : COLORS.ink, backgroundColor: active ? '#F4E6DA' : COLORS.paper }]} />
          <View style={[styles.memorySpine, { backgroundColor: active ? COLORS.active : COLORS.ink }]} />
          <View style={[styles.memoryLine, { backgroundColor: active ? COLORS.active : COLORS.ink }]} />
          <View style={[styles.memoryLine, styles.memoryLineShort, { backgroundColor: active ? COLORS.active : COLORS.ink }]} />
        </View>;
      case 'settings':
        return <View style={styles.settingsIcon}>
          <View style={[styles.gearCore, { borderColor: active ? COLORS.active : COLORS.ink }]} />
          {[0, 45, 90, 135].map(angle => <View key={angle} style={[styles.gearTooth, { backgroundColor: active ? COLORS.active : COLORS.ink, transform: [{ rotate: angle + 'deg' }] }]} />)}
          <View style={[styles.gearHole, { backgroundColor: COLORS.paper }]} />
        </View>;
    }
  })();

  return <View style={styles.frame} accessible={false}>
    <Animated.View pointerEvents="none" style={[styles.activePill, { opacity: progress, transform: [{ scale: activeScale }] }]} />
    <Animated.View style={{ transform: [{ scale: press }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }) }] }}>
      {icon}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  activePill: { position: 'absolute', width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.clay },
  chatIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  chatBubble: { position: 'absolute', top: 3, width: 21, height: 16, borderRadius: 6, backgroundColor: COLORS.paper },
  chatTail: { position: 'absolute', bottom: 3, left: 5, width: 6, height: 6, borderLeftWidth: 1.8, borderBottomWidth: 1.8, backgroundColor: COLORS.paper, transform: [{ rotate: '-28deg' }] },
  chatDots: { flexDirection: 'row', gap: 3, marginTop: -2 },
  chatDot: { width: 2.6, height: 2.6, borderRadius: 2 },
  discoverIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  compassOuter: { width: 21, height: 21, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  compassNeedle: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', top: 3, transform: [{ rotate: '22deg' }] },
  compassSpark: { position: 'absolute', right: -1, top: 0, width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.peach },
  memoryIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center' },
  memoryBook: { width: 18, height: 21, borderWidth: 1.9, borderRadius: 4 },
  memorySpine: { position: 'absolute', left: 4, top: 3, width: 1.5, height: 17, opacity: 0.8 },
  memoryLine: { position: 'absolute', left: 9, top: 9, width: 8, height: 1.5, borderRadius: 1 },
  memoryLineShort: { top: 13, width: 6 },
  settingsIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  gearCore: { width: 17, height: 17, borderWidth: 2.4, borderRadius: 9 },
  gearTooth: { position: 'absolute', width: 4, height: 22, borderRadius: 2 },
  gearHole: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});

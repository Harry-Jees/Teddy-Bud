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
  const selected = useRef(new Animated.Value(active ? 1 : 0)).current;
  const interaction = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const previousPulse = useRef(pulseKey);

  useEffect(() => {
    Animated.spring(selected, {
      toValue: active ? 1 : 0,
      speed: 19,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [active, selected]);

  useEffect(() => {
    if (previousPulse.current === pulseKey) return;
    previousPulse.current = pulseKey;
    if (reduceMotion) return;
    interaction.stopAnimation();
    interaction.setValue(0);
    Animated.sequence([
      Animated.timing(interaction, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(interaction, { toValue: 0, speed: 15, bounciness: 8, useNativeDriver: true }),
    ]).start();
    if (name === 'discover') {
      sparkle.setValue(0);
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [pulseKey, name, reduceMotion, interaction, sparkle]);

  useEffect(() => {
    if (reduceMotion) {
      interaction.setValue(0);
      sparkle.setValue(0);
    }
  }, [reduceMotion, interaction, sparkle]);

  const activeScale = selected.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const activeColor = active ? COLORS.active : COLORS.ink;
  const pop = interaction.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1.18, 1] });
  const lift = interaction.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] });
  const rotate = interaction.interpolate({ inputRange: [0, 1], outputRange: ['0deg', name === 'settings' ? '65deg' : name === 'discover' ? '180deg' : '0deg'] });
  const pageTurn = interaction.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-22deg', '0deg'] });

  const icon = (() => {
    switch (name) {
      case 'chat':
        return <Animated.View style={[styles.chatIcon, { transform: [{ scale: pop }, { translateY: lift }] }]}>
          <View style={[styles.chatBubble, { borderColor: activeColor }]} />
          <View style={[styles.chatTail, { borderColor: activeColor }]} />
          <View style={styles.chatDots}>
            {[0, 1, 2].map(index => <Animated.View key={index} style={[styles.chatDot, { backgroundColor: activeColor, opacity: interaction.interpolate({ inputRange: [0, 0.25 + index * 0.12, 0.6 + index * 0.1, 1], outputRange: [0.75, 1, 0.45, 0.75] }) }]} />)}
          </View>
        </Animated.View>;
      case 'discover':
        return <View style={styles.discoverIcon}>
          <View style={[styles.compassOuter, { borderColor: activeColor }]} />
          <Animated.View style={[styles.compassNeedleWrap, { transform: [{ rotate }] }]}>
            <View style={[styles.compassNeedle, { borderBottomColor: activeColor }]} />
          </Animated.View>
          <Animated.View style={[styles.compassSpark, { opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.45] }), { rotate: '45deg' }] }]} />
        </View>;
      case 'memories':
        return <View style={styles.memoryIcon}>
          <Animated.View style={[styles.memoryBook, { borderColor: activeColor, backgroundColor: active ? '#F4E6DA' : COLORS.paper, transform: [{ perspective: 300 }, { rotateY: pageTurn }, { scale: pop }] }]}>
            <View style={[styles.memorySpine, { backgroundColor: activeColor }]} />
            <View style={[styles.memoryLine, { backgroundColor: activeColor }]} />
            <View style={[styles.memoryLine, styles.memoryLineShort, { backgroundColor: activeColor }]} />
          </Animated.View>
        </View>;
      case 'settings':
        return <Animated.View style={[styles.settingsIcon, { transform: [{ rotate }, { scale: pop }] }]}>
          <View style={[styles.gearCore, { borderColor: activeColor }]} />
          {[0, 45, 90, 135].map(angle => <View key={angle} style={[styles.gearTooth, { backgroundColor: activeColor, transform: [{ rotate: angle + 'deg' }] }]} />)}
          <View style={[styles.gearHole, { backgroundColor: COLORS.paper }]} />
        </Animated.View>;
    }
  })();

  return <View style={styles.frame} accessible={false}>
    <Animated.View pointerEvents="none" style={[styles.activePill, { opacity: selected, transform: [{ scale: activeScale }] }]} />
    {icon}
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  activePill: { position: 'absolute', width: 36, height: 36, borderRadius: 13, backgroundColor: COLORS.clay },
  chatIcon: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  chatBubble: { position: 'absolute', top: 3, width: 21, height: 16, borderWidth: 2, borderRadius: 6, backgroundColor: COLORS.paper },
  chatTail: { position: 'absolute', bottom: 3, left: 5, width: 6, height: 6, borderLeftWidth: 1.8, borderBottomWidth: 1.8, backgroundColor: COLORS.paper, transform: [{ rotate: '-28deg' }] },
  chatDots: { flexDirection: 'row', gap: 3, marginTop: -2 },
  chatDot: { width: 2.7, height: 2.7, borderRadius: 2 },
  discoverIcon: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  compassOuter: { width: 21, height: 21, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  compassNeedleWrap: { position: 'absolute', width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  compassNeedle: { width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', top: -1, transform: [{ rotate: '22deg' }] },
  compassSpark: { position: 'absolute', right: -1, top: 0, width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.peach },
  memoryIcon: { width: 24, height: 25, alignItems: 'center', justifyContent: 'center' },
  memoryBook: { width: 19, height: 22, borderWidth: 1.8, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  memorySpine: { position: 'absolute', left: 4, top: 2, width: 1.5, height: 17, opacity: 0.8 },
  memoryLine: { position: 'absolute', left: 9, top: 8, width: 7, height: 1.5, borderRadius: 1 },
  memoryLineShort: { top: 12, width: 5 },
  settingsIcon: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  gearCore: { width: 17, height: 17, borderWidth: 2.4, borderRadius: 9 },
  gearTooth: { position: 'absolute', width: 4, height: 22, borderRadius: 2 },
  gearHole: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});

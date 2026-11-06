import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export type AnimatedNavIconName = 'chat' | 'discover' | 'memories' | 'settings';

type Props = {
  name: AnimatedNavIconName;
  active: boolean;
  pulseKey: number;
  reduceMotion: boolean;
};

const COLORS = {
  ink: '#78685B',
  active: '#6B5140',
  clay: '#EAD8C8',
  peach: '#DDAF91',
  cream: '#FFF9F2',
};

export function AnimatedNavIcon({ name, active, pulseKey, reduceMotion }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(halo, {
      toValue: active ? 1 : 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [active, halo, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      rotation.setValue(0);
      return;
    }
    scale.setValue(0.92);
    rotation.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.2, speed: 22, bounciness: 12, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 8, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rotation, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(rotation, { toValue: 0, speed: 16, bounciness: 10, useNativeDriver: true }),
      ]),
    ]).start();
  }, [pulseKey, active, reduceMotion, rotation, scale]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', name === 'settings' ? '32deg' : '-10deg'] });

  return (
    <View style={styles.frame} accessible={false}>
      <Animated.View pointerEvents="none" style={[styles.halo, { opacity: halo }]} />
      <Animated.View style={{ transform: [{ scale }, { rotate: name === 'settings' || name === 'discover' ? spin : '0deg' }] }}>
        {name === 'chat' && (
          <View style={[styles.chatBubble, active && styles.activeOutline]}>
            <View style={styles.chatDots}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
            <View style={[styles.chatTail, active && styles.activeTail]} />
          </View>
        )}
        {name === 'discover' && (
          <View style={styles.sparkleWrap}>
            <Text style={[styles.sparkle, active && styles.activeGlyph]}>✦</Text>
            <View style={styles.sparkleDot} />
            <View style={styles.sparkleMini} />
          </View>
        )}
        {name === 'memories' && (
          <View style={styles.heartWrap}>
            <Text style={[styles.heart, active && styles.activeGlyph]}>♡</Text>
            <View style={styles.heartShine} />
          </View>
        )}
        {name === 'settings' && (
          <View style={styles.gearWrap}>
            <Text style={[styles.gear, active && styles.activeGlyph]}>⚙</Text>
            <View style={styles.gearCenter} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 30, height: 29, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 29, height: 29, borderRadius: 15, backgroundColor: COLORS.clay },
  chatBubble: { width: 21, height: 16, borderWidth: 1.8, borderColor: COLORS.ink, borderRadius: 7, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  activeOutline: { borderColor: COLORS.active, backgroundColor: '#F7E8DB' },
  chatDots: { flexDirection: 'row', gap: 2.5, alignItems: 'center' },
  dot: { width: 2.7, height: 2.7, borderRadius: 2, backgroundColor: COLORS.ink },
  chatTail: { position: 'absolute', bottom: -4, left: 4, width: 7, height: 7, backgroundColor: COLORS.cream, borderLeftWidth: 1.6, borderBottomWidth: 1.6, borderColor: COLORS.ink, transform: [{ skewY: '-32deg' }] },
  activeTail: { backgroundColor: '#F7E8DB', borderColor: COLORS.active },
  sparkleWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  sparkle: { color: COLORS.ink, fontSize: 24, lineHeight: 26, fontWeight: '500' },
  activeGlyph: { color: COLORS.active },
  sparkleDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.peach, top: 1, right: 0 },
  sparkleMini: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.ink, bottom: 2, left: 1 },
  heartWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  heart: { color: COLORS.ink, fontSize: 28, lineHeight: 29, fontWeight: '400', marginTop: -1 },
  heartShine: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.peach, top: 5, right: 4 },
  gearWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  gear: { color: COLORS.ink, fontSize: 22, lineHeight: 25 },
  gearCenter: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.peach },
});

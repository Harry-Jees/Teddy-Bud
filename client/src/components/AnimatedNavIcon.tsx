import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { BookHeart, Compass, MessageSquare, Settings } from 'lucide-react-native';

export type AnimatedNavIconName = 'chat' | 'discover' | 'memories' | 'settings';

type Props = {
  name: AnimatedNavIconName;
  active: boolean;
  pulseKey: number;
  reduceMotion: boolean;
};

const ICONS = {
  chat: MessageSquare,
  discover: Compass,
  memories: BookHeart,
  settings: Settings,
} as const;

export function AnimatedNavIcon({ name, active, pulseKey, reduceMotion }: Props) {
  const selected = useRef(new Animated.Value(active ? 1 : 0)).current;
  const interaction = useRef(new Animated.Value(0)).current;
  const previousPulse = useRef(pulseKey);

  useEffect(() => {
    if (reduceMotion) {
      selected.setValue(active ? 1 : 0);
      return;
    }
    Animated.spring(selected, { toValue: active ? 1 : 0, speed: 19, bounciness: 3, useNativeDriver: true }).start();
  }, [active, selected, reduceMotion]);

  useEffect(() => {
    if (previousPulse.current === pulseKey) return;
    previousPulse.current = pulseKey;
    if (reduceMotion) return;
    interaction.stopAnimation();
    interaction.setValue(0);
    Animated.sequence([
      Animated.timing(interaction, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(interaction, { toValue: 0, speed: 17, bounciness: 5, useNativeDriver: true }),
    ]).start();
  }, [pulseKey, reduceMotion, interaction]);

  useEffect(() => {
    if (reduceMotion) interaction.setValue(0);
  }, [reduceMotion, interaction]);

  const Icon = ICONS[name];
  const activeScale = selected.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const pulseScale = interaction.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1.045, 1] });
  const liftAmount = name === 'memories' ? -3 : name === 'chat' ? -2 : -1;
  const rotationAmount = name === 'settings' ? '18deg' : name === 'discover' ? '9deg' : name === 'memories' ? '-5deg' : '-3deg';
  const lift = interaction.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, liftAmount, 0] });
  const rotate = interaction.interpolate({ inputRange: [0, 1], outputRange: ['0deg', rotationAmount] });

  return <View accessible={false} style={styles.container}>
    <Animated.View pointerEvents="none" style={[styles.activeBackground, { opacity: selected, transform: [{ scale: activeScale }] }]} />
    <Animated.View style={[styles.iconMotion, { transform: [{ scale: pulseScale }, { translateY: lift }, { rotate }] }]}>
      <Icon size={21} color={active ? '#684D3B' : '#82766C'} strokeWidth={1.85} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  container: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  activeBackground: { position: 'absolute', width: 36, height: 36, borderRadius: 13, backgroundColor: '#F0E1D4' },
  glassActiveBackground: { backgroundColor: 'rgba(255, 255, 255, 0.66)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.92)', shadowColor: '#75513D', shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  iconMotion: {},
});

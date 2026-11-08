import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { AppIcon } from './AppIcon';
import { RoundedText as Text, RoundedTextInput as TextInput } from './RoundedText';

type StudioMode = 'breathe' | 'ground' | 'focus' | 'rest';

const MODES: { id: StudioMode; label: string; description: string; icon: 'sun' | 'heart' | 'sparkle' | 'cloud' }[] = [
  { id: 'breathe', label: 'Breathe', description: 'A slower rhythm', icon: 'sun' },
  { id: 'ground', label: 'Grounding', description: 'Come back to now', icon: 'heart' },
  { id: 'focus', label: 'Focus', description: 'One thing at a time', icon: 'sparkle' },
  { id: 'rest', label: 'Wind down', description: 'A softer landing', icon: 'cloud' },
];

const GROUNDING_STEPS = [
  { sense: 'SEE', prompt: 'Notice five things you can see.', detail: 'Let your eyes move slowly. Pick out a colour, a shape, or a small detail.' },
  { sense: 'FEEL', prompt: 'Notice four things you can feel.', detail: 'Feel your feet, the chair beneath you, or the air on your skin.' },
  { sense: 'HEAR', prompt: 'Notice three sounds around you.', detail: 'Listen for something near, something far, and the quiet between.' },
  { sense: 'SMELL', prompt: 'Notice two scents.', detail: 'If nothing stands out, simply notice the air as you breathe.' },
  { sense: 'TASTE', prompt: 'Notice one taste or sensation.', detail: 'Let your jaw soften and take one comfortable breath.' },
];

const REST_STEPS = [
  { title: 'Unclench your jaw', detail: 'Let your tongue rest. Give your face permission to soften.' },
  { title: 'Drop your shoulders', detail: 'Let them settle without forcing them down.' },
  { title: 'Relax your hands', detail: 'Uncurl your fingers and let your palms rest.' },
  { title: 'Let the day be done', detail: 'You do not have to solve anything in this moment.' },
];

function clock(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function WellbeingStudio({ wide, reduceMotion, hapticsEnabled }: { wide: boolean; reduceMotion: boolean; hapticsEnabled: boolean }) {
  const [mode, setMode] = useState<StudioMode>('breathe');
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [remaining, setRemaining] = useState(180);
  const [duration, setDuration] = useState(3);
  const [groundStep, setGroundStep] = useState(0);
  const [restStep, setRestStep] = useState(0);
  const [focusTask, setFocusTask] = useState('');
  const [focusMinutes, setFocusMinutes] = useState(15);
  const orb = useRef(new Animated.Value(1)).current;

  const totalSeconds = mode === 'focus' ? focusMinutes * 60 : duration * 60;
  const progress = Math.min(1, Math.max(0, (totalSeconds - remaining) / Math.max(1, totalSeconds)));

  useEffect(() => {
    if (!active || mode === 'ground') return undefined;
    const timer = setInterval(() => {
      setRemaining(current => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [active, mode]);

  useEffect(() => {
    if (active && remaining === 0) {
      setActive(false);
      setCompleted(true);
    }
  }, [active, remaining]);

  useEffect(() => {
    orb.stopAnimation();
    if (reduceMotion || mode !== 'breathe' || !active) {
      orb.setValue(1);
      return undefined;
    }
    const breathing = Animated.loop(Animated.sequence([
      Animated.timing(orb, { toValue: 1.13, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(orb, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    breathing.start();
    return () => breathing.stop();
  }, [active, mode, orb, reduceMotion]);

  const tap = (action: () => void) => {
    if (hapticsEnabled) { try { Vibration.vibrate(8); } catch { /* Haptics are optional and must not interrupt a session. */ } }
    action();
  };

  const selectMode = (next: StudioMode) => {
    tap(() => {
      setMode(next);
      setActive(false);
      setCompleted(false);
      setGroundStep(0);
      setRestStep(0);
      const minutes = next === 'focus' ? focusMinutes : next === 'rest' ? 4 : 3;
      setDuration(minutes);
      setRemaining(minutes * 60);
    });
  };

  const toggleTimer = () => {
    tap(() => {
      if (active) {
        setActive(false);
        return;
      }
      if (remaining <= 0 || completed) {
        setRemaining(totalSeconds);
        setCompleted(false);
      }
      setActive(true);
    });
  };

  const resetTimer = () => tap(() => {
    setActive(false);
    setCompleted(false);
    setRemaining(totalSeconds);
  });

  const chooseDuration = (minutes: number) => tap(() => {
    setDuration(minutes);
    setRemaining(minutes * 60);
    setActive(false);
    setCompleted(false);
  });

  return (
    <ScrollView contentContainerStyle={[styles.page, wide && styles.pageWide]} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>A LITTLE ROOM TO BREATHE</Text>
      <Text style={styles.title}>Wellbeing Studio</Text>
      <Text style={styles.intro}>Choose the kind of pause you need. Each space is designed for a different moment.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRail}>
        {MODES.map(item => {
          const selected = mode === item.id;
          return (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => selectMode(item.id)} style={[styles.modeCard, selected && styles.modeCardSelected]}>
              <View style={[styles.modeIcon, selected && styles.modeIconSelected]}><AppIcon name={item.icon} color={selected ? '#FFFCF7' : '#75513D'} size={18} /></View>
              <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{item.label}</Text>
              <Text style={[styles.modeDescription, selected && styles.modeDescriptionSelected]}>{item.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {mode === 'breathe' && (
        <View style={styles.breathePanel}>
          <Text style={styles.panelEyebrow}>FOLLOW YOUR OWN PACE</Text>
          <Text style={styles.panelTitle}>A slower breath</Text>
          <Text style={styles.panelBody}>Breathe in as the circle grows, then let the breath leave as it settles.</Text>
          <Animated.View style={[styles.breathOrb, { transform: [{ scale: orb }] }]}>
            <View style={styles.breathOrbInner}><Text style={styles.breathOrbText}>{active ? 'Breathe' : 'Ready'}</Text></View>
          </Animated.View>
          <Text style={styles.timer}>{clock(remaining)}</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
          <View style={styles.timerActions}>
            <Pressable accessibilityRole="button" onPress={toggleTimer} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{active ? 'Pause' : completed ? 'Begin again' : 'Begin gently'}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={resetTimer} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Reset</Text></Pressable>
          </View>
          {!active && <DurationPicker selected={duration} values={[2, 3, 5, 10]} onSelect={chooseDuration} />}
        </View>
      )}

      {mode === 'ground' && (
        <View style={styles.groundPanel}>
          <View style={styles.groundHeader}>
            <View><Text style={styles.panelEyebrow}>FIVE SENSES</Text><Text style={styles.panelTitle}>Come back to now</Text></View>
            <Text style={styles.stepCount}>{groundStep + 1} / 5</Text>
          </View>
          <View style={styles.groundProgress}>{GROUNDING_STEPS.map((step, index) => <View key={step.sense} style={[styles.groundProgressDot, index <= groundStep && styles.groundProgressDotActive]} />)}</View>
          <View style={styles.groundStepCard}>
            <Text style={styles.groundSense}>{GROUNDING_STEPS[groundStep].sense}</Text>
            <Text style={styles.groundPrompt}>{GROUNDING_STEPS[groundStep].prompt}</Text>
            <Text style={styles.groundDetail}>{GROUNDING_STEPS[groundStep].detail}</Text>
          </View>
          <View style={styles.timerActions}>
            <Pressable accessibilityRole="button" disabled={groundStep === 0} onPress={() => tap(() => setGroundStep(step => Math.max(0, step - 1)))} style={[styles.secondaryButton, groundStep === 0 && styles.disabled]}><Text style={styles.secondaryButtonText}>Back</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => tap(() => setGroundStep(step => step === 4 ? 0 : step + 1))} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{groundStep === 4 ? 'Start again' : 'Next sense'}</Text></Pressable>
          </View>
        </View>
      )}

      {mode === 'focus' && (
        <View style={styles.focusPanel}>
          <Text style={styles.panelEyebrow}>A QUIET POCKET OF TIME</Text>
          <Text style={styles.panelTitle}>One thing at a time</Text>
          <Text style={styles.panelBody}>Choose one small thing. Let everything else wait until this little session is done.</Text>
          <Text style={styles.fieldLabel}>WHAT WOULD YOU LIKE TO FOCUS ON?</Text>
          <TextInput value={focusTask} onChangeText={setFocusTask} placeholder="One small thing…" placeholderTextColor="#9B8878" style={styles.focusInput} returnKeyType="done" />
          <View style={styles.focusClockWrap}><Text style={styles.focusClock}>{clock(remaining)}</Text><Text style={styles.focusClockCaption}>{completed ? 'You made space for it.' : active ? 'Stay with this moment' : 'Your time, your pace'}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
          <View style={styles.durationRow}>{[5, 15, 25].map(minutes => <Pressable key={minutes} accessibilityRole="button" accessibilityState={{ selected: focusMinutes === minutes }} onPress={() => tap(() => { setFocusMinutes(minutes); setRemaining(minutes * 60); setActive(false); setCompleted(false); })} style={[styles.durationChip, focusMinutes === minutes && styles.durationChipSelected]}><Text style={[styles.durationText, focusMinutes === minutes && styles.durationTextSelected]}>{minutes} min</Text></Pressable>)}</View>
          <View style={styles.timerActions}>
            <Pressable accessibilityRole="button" onPress={toggleTimer} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{active ? 'Pause focus' : completed ? 'Begin again' : 'Start focus'}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={resetTimer} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Reset</Text></Pressable>
          </View>
        </View>
      )}

      {mode === 'rest' && (
        <View style={styles.restPanel}>
          <Text style={styles.panelEyebrow}>A GENTLE BODY SCAN</Text>
          <Text style={styles.panelTitle}>Ease into rest</Text>
          <Text style={styles.panelBody}>There is nothing to complete here. Just let each part of you soften a little.</Text>
          <View style={styles.restScene}>
            <View style={styles.restMoon}><AppIcon name="sun" color="#75513D" size={28} /></View>
            <Text style={styles.restCue}>{REST_STEPS[restStep].title}</Text>
            <Text style={styles.restDetail}>{REST_STEPS[restStep].detail}</Text>
          </View>
          <View style={styles.restStepRow}>{REST_STEPS.map((step, index) => <Pressable key={step.title} accessibilityRole="button" accessibilityState={{ selected: restStep === index }} onPress={() => tap(() => setRestStep(index))} style={[styles.restStepDot, restStep === index && styles.restStepDotSelected]} />)}</View>
          <View style={styles.timerActions}>
            <Pressable accessibilityRole="button" onPress={() => tap(() => setRestStep(step => (step + 1) % REST_STEPS.length))} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Next gentle step</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => tap(() => setRestStep(0))} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Start over</Text></Pressable>
          </View>
        </View>
      )}

      <Text style={styles.footnote}>No streaks, scores, or pressure. Pause or leave whenever you need. These are gentle self-care tools, not medical treatment.</Text>
    </ScrollView>
  );
}

function DurationPicker({ selected, values, onSelect }: { selected: number; values: number[]; onSelect: (minutes: number) => void }) {
  return <View style={styles.durationRow}>
    <Text style={styles.durationCaption}>TIME</Text>
    {values.map(minutes => <Pressable key={minutes} accessibilityRole="button" accessibilityState={{ selected: selected === minutes }} onPress={() => onSelect(minutes)} style={[styles.durationChip, selected === minutes && styles.durationChipSelected]}><Text style={[styles.durationText, selected === minutes && styles.durationTextSelected]}>{minutes} min</Text></Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  pageWide: { paddingHorizontal: 36, paddingTop: 30 },
  eyebrow: { color: '#8B6D57', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: '#503728', fontFamily: 'sans-serif-rounded', fontSize: 29, fontWeight: '800', marginTop: 7 },
  intro: { color: '#857568', fontSize: 13, lineHeight: 20, marginTop: 7, maxWidth: 560 },
  modeRail: { gap: 10, paddingVertical: 20 },
  modeCard: { width: 150, minHeight: 112, borderRadius: 22, borderWidth: 1, borderColor: '#E8D9CA', backgroundColor: '#FFFCF7', padding: 13 },
  modeCardSelected: { backgroundColor: '#75513D', borderColor: '#75513D' },
  modeIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#F1E6DA', alignItems: 'center', justifyContent: 'center' },
  modeIconSelected: { backgroundColor: 'rgba(255,255,255,0.18)' },
  modeTitle: { color: '#503728', fontFamily: 'sans-serif-rounded', fontSize: 13, fontWeight: '700', marginTop: 9 },
  modeTitleSelected: { color: '#FFFCF7' },
  modeDescription: { color: '#857568', fontSize: 10, marginTop: 3 },
  modeDescriptionSelected: { color: '#F4E3D7' },
  breathePanel: { backgroundColor: '#F2E5D9', borderColor: '#E3CDBB', borderWidth: 1, borderRadius: 28, padding: 22, alignItems: 'center' },
  groundPanel: { backgroundColor: '#F1E6DA', borderColor: '#E3CDBB', borderWidth: 1, borderRadius: 26, padding: 20 },
  focusPanel: { backgroundColor: '#F4EBDD', borderColor: '#E7D8BD', borderWidth: 1, borderRadius: 24, padding: 22 },
  restPanel: { backgroundColor: '#EEE4DF', borderColor: '#E0D1C9', borderWidth: 1, borderRadius: 28, padding: 22 },
  panelEyebrow: { color: '#8B6D57', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  panelTitle: { color: '#503728', fontFamily: 'sans-serif-rounded', fontSize: 23, fontWeight: '800', marginTop: 8 },
  panelBody: { color: '#806F62', fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: 500 },
  breathOrb: { width: 184, height: 184, borderRadius: 92, backgroundColor: '#D8B49A', borderWidth: 12, borderColor: '#EAD6C5', alignItems: 'center', justifyContent: 'center', marginVertical: 25 },
  breathOrbInner: { width: 132, height: 132, borderRadius: 66, backgroundColor: '#A8795E', alignItems: 'center', justifyContent: 'center' },
  breathOrbText: { color: '#FFFCF7', fontFamily: 'sans-serif-rounded', fontSize: 17, fontWeight: '700' },
  timer: { color: '#503728', fontSize: 32, fontVariant: ['tabular-nums'], fontWeight: '600' },
  progressTrack: { width: '100%', maxWidth: 420, height: 7, borderRadius: 8, backgroundColor: '#E4D2C4', overflow: 'hidden', marginTop: 13 },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: '#75513D' },
  timerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  primaryButton: { minWidth: 144, minHeight: 46, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#75513D' },
  primaryButtonText: { color: '#FFFCF7', fontFamily: 'sans-serif-rounded', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minWidth: 96, minHeight: 44, borderRadius: 15, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)', borderWidth: 1, borderColor: 'rgba(117,81,61,0.15)' },
  secondaryButtonText: { color: '#503728', fontSize: 12, fontWeight: '700' },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 17 },
  durationCaption: { color: '#857568', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  durationChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.58)', borderWidth: 1, borderColor: 'rgba(117,81,61,0.12)' },
  durationChipSelected: { backgroundColor: '#75513D', borderColor: '#75513D' },
  durationText: { color: '#503728', fontSize: 11, fontWeight: '700' },
  durationTextSelected: { color: '#FFFCF7' },
  groundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepCount: { color: '#75513D', fontSize: 12, fontWeight: '800' },
  groundProgress: { flexDirection: 'row', gap: 7, marginTop: 20 },
  groundProgressDot: { flex: 1, height: 5, borderRadius: 4, backgroundColor: '#E4D2C4' },
  groundProgressDotActive: { backgroundColor: '#B58C6C' },
  groundStepCard: { backgroundColor: '#FFFCF7', borderRadius: 22, padding: 22, marginTop: 18, minHeight: 210, justifyContent: 'center' },
  groundSense: { color: '#A8795E', fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  groundPrompt: { color: '#503728', fontFamily: 'sans-serif-rounded', fontSize: 23, fontWeight: '800', lineHeight: 30, marginTop: 14 },
  groundDetail: { color: '#857568', fontSize: 13, lineHeight: 20, marginTop: 12 },
  fieldLabel: { color: '#806F62', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 22 },
  focusInput: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#E2D1B8', backgroundColor: '#FFFCF7', paddingHorizontal: 14, color: '#503728', fontSize: 14, marginTop: 8 },
  focusClockWrap: { alignItems: 'center', paddingVertical: 24 },
  focusClock: { color: '#503728', fontSize: 48, fontVariant: ['tabular-nums'], fontWeight: '300' },
  focusClockCaption: { color: '#857568', fontSize: 11, marginTop: 4 },
  restScene: { minHeight: 240, borderRadius: 24, backgroundColor: '#FAF5F1', alignItems: 'center', justifyContent: 'center', padding: 22, marginTop: 18 },
  restMoon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EAD9CE', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  restCue: { color: '#503728', fontFamily: 'sans-serif-rounded', fontSize: 21, fontWeight: '800', textAlign: 'center' },
  restDetail: { color: '#857568', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9, maxWidth: 350 },
  restStepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 17 },
  restStepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D7C8BE' },
  restStepDotSelected: { width: 22, backgroundColor: '#75513D' },
  disabled: { opacity: 0.4 },
  footnote: { color: '#857568', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 18, maxWidth: 560, alignSelf: 'center' },
});

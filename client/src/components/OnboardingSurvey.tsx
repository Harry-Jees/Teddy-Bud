import React, { useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcon';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type WellbeingSurveyAnswer = { question: string; answer: string };
type Question = { prompt: string; options: string[] };

const QUESTIONS: Question[] = [
  { prompt: 'How has your sleep been lately?', options: ['Very restful', 'Mostly okay', 'A little disrupted', 'Very difficult', 'Prefer not to say'] },
  { prompt: 'How many hours do you usually sleep?', options: ['Under 5', '5–6', '7–8', '9 or more', 'It varies'] },
  { prompt: 'How rested do you feel when you wake up?', options: ['Very rested', 'Somewhat rested', 'Not very rested', 'Exhausted', 'It varies'] },
  { prompt: 'How would you describe your stress lately?', options: ['Low', 'Manageable', 'Moderate', 'High', 'Prefer not to say'] },
  { prompt: 'What has been taking most of your mental energy?', options: ['Studies or work', 'Relationships', 'Family', 'Health or routines', 'Uncertainty or change', 'Something else', 'Prefer not to say'] },
  { prompt: 'How often have you felt anxious or on edge?', options: ['Rarely', 'Some days', 'Most days', 'Almost every day', 'Prefer not to say'] },
  { prompt: 'How often have you felt low or down?', options: ['Rarely', 'Some days', 'Most days', 'Almost every day', 'Prefer not to say'] },
  { prompt: 'How would you describe your energy during the day?', options: ['High', 'Steady', 'Up and down', 'Usually low', 'Prefer not to say'] },
  { prompt: 'How easy is it to focus on things?', options: ['Very easy', 'Mostly easy', 'Sometimes difficult', 'Very difficult'] },
  { prompt: 'How connected do you feel to people around you?', options: ['Very connected', 'Somewhat connected', 'A little disconnected', 'Very lonely', 'Prefer not to say'] },
  { prompt: 'Do you feel you have someone you can talk to?', options: ['Yes, easily', 'Yes, sometimes', 'Not really', 'I am not sure', 'Prefer not to say'] },
  { prompt: 'How supported do you feel right now?', options: ['Very supported', 'Somewhat supported', 'Not very supported', 'Unsupported', 'Prefer not to say'] },
  { prompt: 'How manageable do your daily responsibilities feel?', options: ['Very manageable', 'Mostly manageable', 'A bit overwhelming', 'Overwhelming', 'Prefer not to say'] },
  { prompt: 'How satisfied are you with your current routine?', options: ['Very satisfied', 'Mostly satisfied', 'Neither', 'Not very satisfied', 'Prefer not to say'] },
  { prompt: 'How often do you make time for things you enjoy?', options: ['Most days', 'A few times a week', 'Occasionally', 'Rarely'] },
  { prompt: 'How comfortable are you asking for help?', options: ['Very comfortable', 'Somewhat comfortable', 'A little uncomfortable', 'Very uncomfortable'] },
  { prompt: 'What would you like Teddy Bud to help you with?', options: ['A friendly chat and emotional support', 'Journaling and reflection', 'Mood check-ins', 'Breathing and relaxation', 'Focus, study, or work', 'Sleep and daily routines', 'Everything', 'I am not sure yet'] },
  { prompt: 'What would you most like support with?', options: ['Stress', 'Sleep and routines', 'Confidence', 'Relationships', 'Motivation', 'Understanding emotions', 'Just having someone listen'] },
  { prompt: 'When you are upset, what usually helps?', options: ['Talking it through', 'Quiet time', 'Movement or going outside', 'Writing things down', 'Practical steps', 'I am still figuring that out'] },
  { prompt: 'How would you like Teddy Bud to respond?', options: ['Listen without judging', 'Offer practical suggestions', 'Encourage me', 'Help me reflect', 'Ask me what I need each time'] },
  { prompt: 'How often would gentle check-ins feel helpful?', options: ['Daily', 'A few times a week', 'Weekly', 'Only when I open the app'] },
  { prompt: 'What tone feels most comfortable?', options: ['Warm and gentle', 'Light and playful', 'Calm and direct', 'Thoughtful and reflective'] },
  { prompt: 'Are there topics you would prefer Teddy Bud not to bring up?', options: ['No particular topics', 'Family', 'Relationships', 'Health', 'Work or studies', 'I will mention them when ready'] },
  { prompt: 'What is one small thing you hope to improve?', options: ['Sleep', 'Stress', 'Balance', 'Connection', 'Confidence', 'Consistency', 'I am not sure yet'] },
  { prompt: 'Anything else you would like Teddy Bud to know?', options: ['No, that is enough for now', 'I would rather share naturally in chat'] },
];

export function OnboardingSurvey({ onComplete }: { onComplete: (answers: WellbeingSurveyAnswer[], createInitialMap: boolean) => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createInitialMap, setCreateInitialMap] = useState(false);
  const slideX = useRef(new Animated.Value(0)).current;
  const transitionLock = useRef(false);
  const question = QUESTIONS[index];
  const progress = useMemo(() => Math.round(((index + 1) / QUESTIONS.length) * 100), [index]);

  const moveTo = (nextIndex: number, direction: -1 | 1) => {
    if (transitionLock.current || saving || nextIndex < 0 || nextIndex >= QUESTIONS.length || nextIndex === index) return;
    transitionLock.current = true;
    Animated.timing(slideX, { toValue: direction * -36, duration: 105, useNativeDriver: true }).start(() => {
      setIndex(nextIndex);
      slideX.setValue(direction * 36);
      Animated.timing(slideX, { toValue: 0, duration: 210, useNativeDriver: true }).start(() => {
        transitionLock.current = false;
      });
    });
  };

  const next = () => {
    if (index < QUESTIONS.length - 1) moveTo(index + 1, 1);
  };
  const previous = () => {
    if (index > 0) moveTo(index - 1, -1);
  };

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 32 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx <= -65) next();
      else if (gesture.dx >= 65) previous();
    },
  })).current;

  const chooseOption = (option: string) => {
    if (saving || transitionLock.current) return;
    setAnswers(current => ({ ...current, [index]: option }));
  };

  const finish = async (skip = false) => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onComplete(skip ? [] : QUESTIONS.flatMap((item, i) => answers[i] ? [{ question: item.prompt, answer: answers[i] }] : []), !skip && createInitialMap);
    } catch {
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Let’s get to know you.</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => { finish(true).catch(() => undefined); }} style={styles.skipTop}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <Text style={styles.count}>{index + 1} / {QUESTIONS.length}</Text>
      <Animated.View style={{ transform: [{ translateX: slideX }] }} {...panResponder.panHandlers}>
        <Text style={styles.question}>{question.prompt}</Text>
        <View style={styles.options}>
          {question.options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: answers[index] === option }} onPress={() => chooseOption(option)} style={[styles.option, answers[index] === option && styles.optionSelected]}>
            <Text style={[styles.optionText, answers[index] === option && styles.optionTextSelected]}>{option}</Text>
            {answers[index] === option && <AppIcon name="check" color="#75513D" size={17} />}
          </Pressable>)}
        </View>
      </Animated.View>
      {index === QUESTIONS.length - 1 && Object.keys(answers).length > 0 ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: createInitialMap }} onPress={() => setCreateInitialMap(value => !value)} style={styles.aiConsent}>
        <View style={[styles.aiConsentBox, createInitialMap && styles.aiConsentBoxChecked]}>{createInitialMap ? <AppIcon name="check" color="#FFFCF7" size={13} /> : null}</View>
        <View style={styles.aiConsentCopy}>
          <Text style={styles.aiConsentTitle}>Create a starting emotion map</Text>
          <Text style={styles.aiConsentBody}>Allow Teddy Bud to send these answers once to its AI service to estimate your starting emotion map. Optional.</Text>
        </View>
      </Pressable> : null}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving || index === 0} onPress={previous} style={[styles.backButton, index === 0 && styles.backButtonDisabled]}>
          
          <Text style={[styles.secondaryText, index === 0 && styles.disabledText]}>Back</Text>
        </Pressable>
        {index === QUESTIONS.length - 1
          ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { finish().catch(() => undefined); }} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Finish'}</Text></Pressable>
          : <Pressable accessibilityRole="button" accessibilityLabel="Next question" disabled={saving || !answers[index]} onPress={next} style={[styles.primary, !answers[index] && styles.primaryDisabled]}><Text style={styles.primaryText}>Next</Text><AppIcon name="arrow" color="#FFFCF7" size={16} /></Pressable>}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F0E7' },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  skipTop: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  eyebrow: { color: '#8A735F', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#3B3029', fontFamily: 'sans-serif-rounded', fontSize: 25, lineHeight: 32, fontWeight: '700', flex: 1 },

  progressTrack: { height: 5, backgroundColor: '#E8D9CA', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 5, backgroundColor: '#75513D', borderRadius: 8 },
  count: { color: '#8A735F', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12 },
  question: { color: '#3B3029', fontFamily: 'sans-serif-rounded', fontSize: 22, lineHeight: 29, fontWeight: '600', marginBottom: 18 },
  options: { gap: 10 },
  option: { borderWidth: 1, borderColor: '#E8D9CA', backgroundColor: '#FFFCF7', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionSelected: { borderColor: '#75513D', backgroundColor: '#F4EEE8' },
  optionText: { color: '#4C4B46', fontFamily: 'sans-serif-rounded', fontSize: 15 },
  optionTextSelected: { color: '#514234', fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D8D5CE' },
  backButtonDisabled: { opacity: 0.5 },
  disabledText: { color: '#B8B1A8' },
  swipeHint: { color: '#85837D', fontSize: 12, marginLeft: 'auto' },
  primary: { minHeight: 48, backgroundColor: '#75513D', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, flex: 1 },
  primaryDisabled: { opacity: 0.42 },
  primaryText: { color: '#FFFCF7', fontFamily: 'sans-serif-rounded', fontWeight: '700', fontSize: 15 },

  secondaryText: { color: '#514234', fontWeight: '600', fontSize: 15 },
  skip: { alignItems: 'center', padding: 16, marginTop: 4 },
  skipText: { color: '#75513D', fontSize: 14, fontWeight: '600' },

  aiConsent: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#E2D5C9', backgroundColor: '#FBF6F1', marginTop: 20 },
  aiConsentBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#A88D78', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  aiConsentBoxChecked: { backgroundColor: '#75513D', borderColor: '#75513D' },
  aiConsentTick: { color: '#FFFCF7', fontSize: 14, fontWeight: '700', lineHeight: 17 },
  aiConsentCopy: { flex: 1, gap: 5 },
  aiConsentTitle: { color: '#514234', fontSize: 13, fontWeight: '700' },
  aiConsentBody: { color: '#857568', fontSize: 11, lineHeight: 16 },
  error: { color: '#8D473F', marginTop: 12 },
});

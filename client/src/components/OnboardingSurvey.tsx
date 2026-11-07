import React, { useMemo, useState } from 'react';
import { AppIcon } from './AppIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const question = QUESTIONS[index];
  const progress = useMemo(() => Math.round((Object.keys(answers).length / QUESTIONS.length) * 100), [answers]);
  const finish = async (skip = false) => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await onComplete(skip ? [] : QUESTIONS.flatMap((item, i) => answers[i] ? [{ question: item.prompt, answer: answers[i] }] : []), !skip && createInitialMap);
    } catch {
      setError('Your answers could not be saved. Please try again; you can also skip for now.');
      setSaving(false);
    }
  };
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>A LITTLE ABOUT YOU</Text>
      <Text style={styles.title}>Let’s make this space feel right.</Text>
      <Text style={styles.body}>A private, optional check-in to help Teddy understand what support feels helpful. This is not a diagnosis or a clinical assessment. You can skip any question or the whole survey.</Text>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
      <Text style={styles.count}>QUESTION {index + 1} OF {QUESTIONS.length}</Text>
      <Text style={styles.question}>{question.prompt}</Text>
      <View style={styles.options}>
        {question.options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: answers[index] === option }} onPress={() => setAnswers(current => ({ ...current, [index]: option }))} style={[styles.option, answers[index] === option && styles.optionSelected]}>
          <Text style={[styles.optionText, answers[index] === option && styles.optionTextSelected]}>{option}</Text>
        </Pressable>)}
      </View>
      {index === QUESTIONS.length - 1 && Object.keys(answers).length > 0 ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: createInitialMap }} onPress={() => setCreateInitialMap(value => !value)} style={styles.aiConsent}>
        <View style={[styles.aiConsentBox, createInitialMap && styles.aiConsentBoxChecked]}>{createInitialMap ? <AppIcon name="check" color="#536C53" size={13} /> : null}</View>
        <View style={styles.aiConsentCopy}>
          <Text style={styles.aiConsentTitle}>Create my starting emotion web</Text>
          <Text style={styles.aiConsentBody}>With your permission, Teddy Bud will send these answers once to its AI service to estimate the 10 emotion values and energy level. The result is labelled as an AI estimate and saved on this device. This is optional and not a diagnosis.</Text>
        </View>
      </Pressable> : null}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving || index === 0} onPress={() => setIndex(current => Math.max(0, current - 1))} style={styles.secondary}><Text style={styles.secondaryText}>Back</Text></Pressable>
        {index < QUESTIONS.length - 1
          ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => setIndex(current => Math.min(QUESTIONS.length - 1, current + 1))} style={styles.primary}><Text style={styles.primaryText}>{answers[index] ? 'Continue' : 'Skip question'}</Text></Pressable>
          : <Pressable accessibilityRole="button" disabled={saving} onPress={() => { finish().catch(() => undefined); }} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Finish'}</Text></Pressable>}
      </View>
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => { finish(true).catch(() => undefined); }} style={styles.skip}><Text style={styles.skipText}>Skip the survey for now</Text></Pressable>
      <Text style={styles.privacy}>Your answers stay in this account’s encrypted local app data unless you opt in above. If enabled, they are sent once to the AI service only to create your starting emotion web; the generated scores are saved on this device.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F8F6' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 28, paddingTop: 42, paddingBottom: 48 },
  eyebrow: { color: '#8A735F', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#272724', fontSize: 30, lineHeight: 38, fontWeight: '700', marginBottom: 10 },
  body: { color: '#73736E', fontSize: 15, lineHeight: 23, marginBottom: 26 },
  progressTrack: { height: 5, backgroundColor: '#E6E5E1', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: 5, backgroundColor: '#685443', borderRadius: 8 },
  count: { color: '#8A735F', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12 },
  question: { color: '#272724', fontSize: 22, lineHeight: 29, fontWeight: '600', marginBottom: 18 },
  options: { gap: 10 },
  option: { borderWidth: 1, borderColor: '#E6E5E1', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 15, minHeight: 52, justifyContent: 'center' },
  optionSelected: { borderColor: '#685443', backgroundColor: '#F4EEE8' },
  optionText: { color: '#4C4B46', fontSize: 15 },
  optionTextSelected: { color: '#514234', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  primary: { backgroundColor: '#685443', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', flex: 1 },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#D8D5CE', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' },
  secondaryText: { color: '#514234', fontWeight: '600', fontSize: 15 },
  skip: { alignItems: 'center', padding: 16, marginTop: 4 },
  skipText: { color: '#685443', fontSize: 14, fontWeight: '600' },
  privacy: { color: '#85837D', fontSize: 12, lineHeight: 18, marginTop: 10 },
  aiConsent: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#E2D5C9', backgroundColor: '#FBF6F1', marginTop: 20 },
  aiConsentBox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#A88D78', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  aiConsentBoxChecked: { backgroundColor: '#685443', borderColor: '#685443' },
  aiConsentTick: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 17 },
  aiConsentCopy: { flex: 1, gap: 5 },
  aiConsentTitle: { color: '#514234', fontSize: 13, fontWeight: '700' },
  aiConsentBody: { color: '#73736E', fontSize: 11, lineHeight: 16 },
  error: { color: '#8D473F', marginTop: 12 },
});

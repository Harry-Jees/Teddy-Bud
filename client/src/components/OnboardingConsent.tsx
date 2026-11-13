import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { openExternalUrl } from '../services/externalNavigation';
import { AppIcon } from './AppIcon';
import { RoundedText as Text } from './RoundedText';
import { teddyTheme } from '../theme';

const PRIVACY_URL = 'https://teddybud.vercel.app/application-privacy';
const TERMS_URL = 'https://teddybud.vercel.app/application-terms';

export function OnboardingConsent({ onComplete }: { onComplete: (allowAiContext: boolean) => Promise<void> }) {
  const [privacyOpened, setPrivacyOpened] = useState(false);
  const [termsOpened, setTermsOpened] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [allowAiContext, setAllowAiContext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openPolicy = async (url: string, markOpened: (value: boolean) => void) => {
    setError('');
    try {
      await openExternalUrl(url);
      markOpened(true);
    } catch {
      setError('Could not open this document. Check your connection and try again.');
    }
  };

  const finish = async () => {
    if (!privacyAccepted || !termsAccepted || busy) return;
    setBusy(true);
    setError('');
    try {
      await onComplete(allowAiContext);
    } catch {
      setError('Your choices could not be saved. Please try again.');
      setBusy(false);
    }
  };

  const CheckRow = ({ checked, onPress, title, description, disabled = false }: {
    checked: boolean; onPress: () => void; title: string; description: string; disabled?: boolean;
  }) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled || busy} onPress={onPress} style={[styles.checkRow, disabled && styles.disabled]}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <AppIcon name="check" color="#FFFCF7" size={14} /> : null}</View>
    <View style={styles.copy}><Text style={styles.checkTitle}>{title}</Text><Text style={styles.description}>{description}</Text></View>
  </Pressable>;

  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.mark}><AppIcon name="shield" color={teddyTheme.colors.primary} size={24} /></View>
      <Text style={styles.eyebrow}>BEFORE YOU BEGIN</Text>
      <Text style={styles.title}>Your privacy, your choice.</Text>
      <Text style={styles.intro}>Please review how Teddy Bud handles your information and the terms for using the app. You can decide separately whether AI may use your saved personal context.</Text>

      <View style={styles.documentCard}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Privacy Policy</Text><Text style={styles.documentMeta}>How Teddy Bud handles your data</Text></View>
        <Pressable accessibilityRole="link" onPress={() => openPolicy(PRIVACY_URL, setPrivacyOpened)} style={styles.openButton}>
          <Text style={styles.openButtonText}>{privacyOpened ? 'Open privacy policy again' : 'Read full Privacy Policy'}</Text><AppIcon name="arrow" color={teddyTheme.colors.primary} size={15} />
        </Pressable>
        <CheckRow checked={privacyAccepted} disabled={!privacyOpened} onPress={() => setPrivacyAccepted(value => !value)} title="I have read and agree to the Privacy Policy" description="Required to continue. Open the full policy first." />
      </View>

      <View style={styles.documentCard}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Terms & Conditions</Text><Text style={styles.documentMeta}>Rules and conditions for using Teddy Bud</Text></View>
        <Pressable accessibilityRole="link" onPress={() => openPolicy(TERMS_URL, setTermsOpened)} style={styles.openButton}>
          <Text style={styles.openButtonText}>{termsOpened ? 'Open Terms again' : 'Read full Terms & Conditions'}</Text><AppIcon name="arrow" color={teddyTheme.colors.primary} size={15} />
        </Pressable>
        <CheckRow checked={termsAccepted} disabled={!termsOpened} onPress={() => setTermsAccepted(value => !value)} title="I have read and agree to the Terms & Conditions" description="Required to continue. Open the full terms first." />
      </View>

      <View style={[styles.documentCard, styles.optionalCard]}>
        <View style={styles.optionalLabel}><Text style={styles.optionalLabelText}>OPTIONAL</Text></View>
        <CheckRow checked={allowAiContext} onPress={() => setAllowAiContext(value => !value)} title="Allow AI to use my saved context" description="When enabled, Teddy Bud may include saved memories, relevant excerpts from other conversations, About me notes, and onboarding answers in AI requests. You can change these controls individually in Privacy settings at any time. If left unchecked, this context stays off." />
      </View>

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={!privacyAccepted || !termsAccepted || busy} onPress={() => { finish().catch(() => undefined); }} style={[styles.continueButton, (!privacyAccepted || !termsAccepted || busy) && styles.continueDisabled]}>
        <Text style={styles.continueText}>{busy ? 'Saving your choices…' : 'Continue to Teddy Bud'}</Text><AppIcon name="arrow" color="#FFFCF7" size={16} />
      </Pressable>
      <Text style={styles.footer}>Your optional AI context choice is separate from accepting the policies.</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: teddyTheme.colors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 36 },
  mark: { width: 48, height: 48, borderRadius: 16, backgroundColor: teddyTheme.colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: teddyTheme.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 9 },
  title: { color: teddyTheme.colors.text, fontFamily: 'sans-serif-rounded', fontSize: 27, lineHeight: 34, fontWeight: '700', marginBottom: 10 },
  intro: { color: teddyTheme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 22 },
  documentCard: { backgroundColor: teddyTheme.colors.surface, borderWidth: 1, borderColor: teddyTheme.colors.border, borderRadius: 18, padding: 16, marginBottom: 12 },
  documentHeader: { marginBottom: 12 },
  documentTitle: { color: teddyTheme.colors.text, fontSize: 16, fontWeight: '700' },
  documentMeta: { color: teddyTheme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  openButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: teddyTheme.colors.borderStrong, backgroundColor: teddyTheme.colors.surfaceSoft, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  openButtonText: { color: teddyTheme.colors.primary, fontSize: 13, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingTop: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: teddyTheme.colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxChecked: { backgroundColor: teddyTheme.colors.primary, borderColor: teddyTheme.colors.primary },
  copy: { flex: 1 },
  checkTitle: { color: teddyTheme.colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  description: { color: teddyTheme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  disabled: { opacity: 0.48 },
  optionalCard: { borderColor: teddyTheme.colors.borderStrong },
  optionalLabel: { alignSelf: 'flex-start', backgroundColor: teddyTheme.colors.primaryContainer, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 7 },
  optionalLabelText: { color: teddyTheme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  error: { color: '#A0443D', fontSize: 13, marginVertical: 10 },
  continueButton: { minHeight: 52, borderRadius: 16, backgroundColor: teddyTheme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  continueDisabled: { opacity: 0.42 },
  continueText: { color: '#FFFCF7', fontSize: 15, fontWeight: '700' },
  footer: { color: teddyTheme.colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 13 },
});

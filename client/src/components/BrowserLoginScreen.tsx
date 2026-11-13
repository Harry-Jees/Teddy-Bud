/**
 * Username/password, recovery, migration, and biometric sign-in UI.
 * Authentication policy lives in browserAuthService; this module only coordinates the form.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoundedText as Text, RoundedTextInput as TextInput } from './RoundedText';
import { AppIcon } from './AppIcon';
import { styles } from '../theme/appStyles';
import { C } from '../theme/palette';
import { browserAuthService } from '../services/browserAuth';
import { authErrorMessage, AuthValidationError } from '../services/authErrors';
import type { AuthField } from '../services/authErrors';
import type { StoredSession } from '../services/session';
import teddyBudLogoAsset from '../../assets/teddy-bud-logo.png';

const teddyBudLogo = typeof teddyBudLogoAsset === 'string' ? { uri: teddyBudLogoAsset } : teddyBudLogoAsset;

function runInBackground(task: Promise<unknown>): void {
  task.then(undefined, error => console.error('A background Teddy Bud task failed.', error));
}

export function BrowserLoginScreen({ error, initialMode, canMigrateLegacy, onAuthenticated }: { error: string | null; initialMode: 'login'; canMigrateLegacy: boolean; onAuthenticated: (session: StoredSession) => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 600;
  const shortScreen = height < 760;
  const [mode, setMode] = useState<'login' | 'recover' | 'migrate'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [recoveryPassphraseVisible, setRecoveryPassphraseVisible] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const authScrollRef = useRef<ScrollView>(null);
  const keepFocusedFieldVisible = (target: number) => {
    const responder = authScrollRef.current?.getScrollResponder() as unknown as {
      scrollResponderScrollNativeHandleToKeyboard?: (nodeHandle: number, additionalOffset?: number, preventNegativeScrollOffset?: boolean) => void;
    } | undefined;
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(target, 24, true);
  };
  useEffect(() => {
    let mounted = true;
    if (Platform.OS !== 'android' || mode !== 'login') {
      setBiometricReady(false);
      return () => { mounted = false; };
    }
    browserAuthService.hasBiometricSignIn().then(ready => {
      if (mounted) setBiometricReady(ready);
    }).catch(() => { if (mounted) setBiometricReady(false); });
    return () => { mounted = false; };
  }, [mode]);

  const signInWithBiometrics = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      onAuthenticated(await browserAuthService.signInWithBiometrics());
    } catch {
      setNotice('Biometric sign-in was cancelled or unavailable. You can use your password instead.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (field: AuthField) => {
    setFieldErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true); setFormError(null); setFieldErrors({}); setNotice(null);
    try {
      if (mode !== 'migrate' && !/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
        throw new AuthValidationError('Use 3–24 characters: lowercase letters, numbers, or underscores.', 'username');
      }
      if (mode === 'login' && !password) throw new AuthValidationError('Enter your password.', 'password');

      if (mode === 'login') {
        onAuthenticated(await browserAuthService.signIn(username.trim().toLowerCase(), password));
      } else if (mode === 'migrate') {
        if (password.length < 15 || password.length > 128) throw new AuthValidationError('Choose a password with 15 to 128 characters.');
        if (password !== confirmPassword) throw new AuthValidationError('The passwords do not match.');
        const phrase = recoveryPassphrase.trim();
        if (phrase.length < 10 || phrase.length > 128) throw new AuthValidationError('Choose a recovery passphrase with 10 to 128 characters.');
        onAuthenticated(await browserAuthService.migrateLegacyAccount(password, phrase));
      } else {
        if (password.length < 15 || password.length > 128) throw new AuthValidationError('Choose a new password with 15 to 128 characters.', 'password');
        if (recoveryPassphrase.trim().length < 10) throw new AuthValidationError('Enter the recovery passphrase you chose when you created your account.', 'recoveryPassphrase');
        await browserAuthService.recoverPassword(username.trim().toLowerCase(), recoveryPassphrase.trim(), password);
        setMode('login'); setPassword(''); setRecoveryPassphrase('');
        setNotice('Password changed. Sign in with your new password.');
      }
    } catch (authError) {
      const context = mode === 'login' ? 'sign-in' : mode === 'recover' ? 'password-recovery' : 'account-migration';
      if (authError instanceof AuthValidationError && authError.field) {
        setFieldErrors({ [authError.field]: authError.message });
        setFormError(null);
      } else {
        setFormError(authErrorMessage(authError, context));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (next: 'login' | 'recover' | 'migrate') => {
    setMode(next); setFormError(null); setFieldErrors({}); setNotice(null); setPassword(''); setPasswordVisible(false); setConfirmPassword(''); setConfirmPasswordVisible(false); setRecoveryPassphrase(''); setRecoveryPassphraseVisible(true);
  };

  const title = mode === 'recover' ? 'Reset password' : mode === 'migrate' ? 'Restore account' : 'Sign in';
  const actionLabel = mode === 'recover' ? 'Change password' : mode === 'migrate' ? 'Move existing account' : 'Sign in';

  return <KeyboardAvoidingView style={[styles.authScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={authScrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.authScrollContent, compact && styles.authScrollContentCompact, shortScreen && styles.authScrollContentShort]}>
    <View style={[styles.authCard, compact && styles.authCardCompact, shortScreen && styles.authCardShort]}>
      <View style={styles.authMark}><Image source={teddyBudLogo} style={styles.authLogo} accessibilityLabel="Teddy Bud" /></View>
      <Text style={styles.authTitle}>{title}</Text>
      {(error || formError) && <View style={styles.authError}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authErrorText}>{formError || error}</Text></View>}
      {!!notice && <View style={styles.authNotice}><Text accessibilityLiveRegion="polite" style={styles.authNoticeText}>{notice}</Text></View>}
      {mode !== 'migrate' && <>
        <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Username" accessibilityHint={fieldErrors.username} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" value={username} onChangeText={value => { setUsername(value); clearFieldError('username'); }} placeholder="Username" placeholderTextColor="#938A80" style={[styles.authInput, fieldErrors.username && styles.authInputInvalid]} editable={!submitting} />
        {fieldErrors.username && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.username}</Text>}
      </>}
      {mode === 'recover' && <>
        <View style={[styles.authPasswordRow, fieldErrors.recoveryPassphrase && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Recovery passphrase" accessibilityHint={fieldErrors.recoveryPassphrase} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry={!recoveryPassphraseVisible} value={recoveryPassphrase} onChangeText={value => { setRecoveryPassphrase(value); clearFieldError('recoveryPassphrase'); }} placeholder="Recovery passphrase" placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
          <Pressable accessibilityRole="button" accessibilityLabel={recoveryPassphraseVisible ? 'Hide recovery passphrase' : 'Show recovery passphrase'} onPress={() => setRecoveryPassphraseVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}><AppIcon name={recoveryPassphraseVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} /></Pressable>
        </View>
        {fieldErrors.recoveryPassphrase && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.recoveryPassphrase}</Text>}
      </>}
      <View style={[styles.authPasswordRow, fieldErrors.password && styles.authInputInvalid]}>
        <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel={mode === 'recover' ? 'New password' : 'Password'} accessibilityHint={fieldErrors.password} autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} secureTextEntry={!passwordVisible} value={password} onChangeText={value => { setPassword(value); clearFieldError('password'); }} placeholder={mode === 'recover' ? 'New password' : 'Password'} placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
        <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} accessibilityHint="Changes whether the password text is visible on this screen" disabled={submitting} onPress={() => setPasswordVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}>
          <AppIcon name={passwordVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} />
        </Pressable>
      </View>
      {fieldErrors.password && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.password}</Text>}
      {mode === 'migrate' && <>
        <View style={[styles.authPasswordRow, fieldErrors.confirmPassword && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Confirm password" accessibilityHint={fieldErrors.confirmPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry={!confirmPasswordVisible} value={confirmPassword} onChangeText={value => { setConfirmPassword(value); clearFieldError('confirmPassword'); }} placeholder="Confirm password" placeholderTextColor="#938A80" style={styles.authPasswordInput} editable={!submitting} />
          <Pressable accessibilityRole="button" accessibilityLabel={confirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'} onPress={() => setConfirmPasswordVisible(current => !current)} style={({ pressed }) => [styles.showPasswordButton, pressed && styles.pressed]}><AppIcon name={confirmPasswordVisible ? 'eyeOff' : 'eye'} color={C.cocoa} size={19} /></Pressable>
        </View>
        {fieldErrors.confirmPassword && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.authFieldError}>{fieldErrors.confirmPassword}</Text>}
        <View style={[styles.authPasswordRow, fieldErrors.recoveryPassphrase && styles.authInputInvalid]}>
          <TextInput onFocus={event => keepFocusedFieldVisible(event.nativeEvent.target)} accessibilityLabel="Recovery passphrase" accessibilityHint={fieldErrors.recoveryPassphrase} autoCapitalize="none" autoCorrect={false} autoComplete="off" secureTextEntry={!recoveryPassphraseVisible} value={recoveryPassphrase} onChangeText={value => { setRecoveryPassphrase(value); clearFieldError('recoveryPassphrase'); }} placeholder="Recovery passphrase" placeholderTextColor="#938A80" maxLength={128} style={styles.authPasswordInput} editable={!submitting} />
        </View>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} disabled={submitting} onPress={submit} style={({ pressed }) => [styles.authButton, submitting && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.authButtonText}>{submitting ? 'Please wait…' : actionLabel}</Text>
      </Pressable>
      {mode === 'login' && biometricReady && <Pressable accessibilityRole="button" accessibilityLabel="Sign in with biometrics" disabled={submitting} onPress={() => { runInBackground(signInWithBiometrics()); }} style={({ pressed }) => [styles.authBiometricButton, pressed && styles.pressed, submitting && styles.buttonDisabled]}><AppIcon name="fingerprint" color={C.cocoaDark} size={21} /><Text style={styles.authBiometricText}>Use biometrics</Text></Pressable>}
      {mode === 'login' && <Pressable accessibilityRole="button" onPress={() => changeMode('recover')} style={styles.authLink}><Text style={styles.authLinkText}>Forgot password?</Text></Pressable>}
      {canMigrateLegacy && mode !== 'recover' && mode !== 'migrate' && <Pressable accessibilityRole="button" onPress={() => changeMode('migrate')} style={styles.authLink}><Text style={styles.authLinkText}>Restore existing chats</Text></Pressable>}
      {mode === 'recover' && <Pressable accessibilityRole="button" onPress={() => changeMode('login')} style={styles.authLink}><Text style={styles.authLinkText}>Back to sign in</Text></Pressable>}
    </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

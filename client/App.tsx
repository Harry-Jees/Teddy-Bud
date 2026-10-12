import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  Linking,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GATEWAY_BASE_URL } from './src/config/gateway';
import { GatewayService } from './src/services/gateway';
import { AccessAuthService, StoredSession } from './src/services/auth';

type Page = 'chat' | 'memories' | 'privacy';
type Memory = { id: number; text: string; date: string };
type Message = { id: number; text: string; author: 'you' | 'teddy'; time: string };

const C = {
  canvas: '#F7F3ED', paper: '#FFFEFB', paperAlt: '#F4EEE6', ink: '#302821',
  muted: '#84796F', line: '#E9E1D7', cocoa: '#765642', cocoaDark: '#60432F',
  peach: '#E7B49A', peachLight: '#F8E9DF', green: '#536C53', greenLight: '#E8EFE5',
  rose: '#A65F50', white: '#FFFFFF',
};

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'chat', icon: '◌', label: 'Your space' },
  { id: 'memories', icon: '✳', label: 'Memories' },
  { id: 'privacy', icon: '⌑', label: 'Privacy' },
];

const gatewayService = new GatewayService(GATEWAY_BASE_URL);
const authService = new AccessAuthService();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.canvas} />
      <AccessGate />
    </SafeAreaProvider>
  );
}

function AccessGate() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const current = await authService.restore();
        if (mounted) setSession(current);
      } catch (restoreError) {
        if (mounted) setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore your sign-in.');
      } finally {
        if (mounted) setBusy(false);
      }
    };
    restore();
    const handleUrl = (url: string) => {
      authService.consumeCallback(url).then(next => {
        if (mounted && next) { setSession(next); setError(null); }
      }).catch(callbackError => {
        if (mounted) setError(callbackError instanceof Error ? callbackError.message : 'Sign-in could not be completed.');
      });
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));
    return () => { mounted = false; subscription.remove(); };
  }, []);

  if (busy) return <AuthLoading />;
  if (!session) return <LoginScreen error={error} onLogin={() => { setError(null); authService.beginLogin().catch(loginError => setError(loginError instanceof Error ? loginError.message : 'Unable to open sign-in.')); }} />;
  return <TeddyBud sessionToken={session.accessToken} onLogout={() => { authService.clear(); setSession(null); }} />;
}

function AuthLoading() {
  return <View style={styles.authScreen}><View style={styles.brandMark}><Text style={styles.brandMarkText}>tb</Text></View><Text style={styles.authTitle}>Opening your private space…</Text><Text style={styles.authBody}>Checking your secure session.</Text></View>;
}

function LoginScreen({ error, onLogin }: { error: string | null; onLogin: () => void }) {
  return <View style={styles.authScreen}>
    <View style={styles.authCard}>
      <View style={styles.authMark}><Text style={styles.brandMarkText}>tb</Text></View>
      <Text style={styles.authEyebrow}>TEDDY BUD</Text>
      <Text style={styles.authTitle}>A little room to breathe.</Text>
      <Text style={styles.authBody}>Sign in with Cloudflare Access to keep your Teddy Bud space private and protected.</Text>
      {error && <View style={styles.authError}><Text style={styles.authErrorText}>{error}</Text></View>}
      <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.authButton, pressed && styles.pressed]}><Text style={styles.authButtonText}>Continue with secure sign-in</Text></Pressable>
      <Text style={styles.authFootnote}>You’ll return to Teddy Bud automatically after authentication.</Text>
    </View>
  </View>;
}

function TeddyBud({ sessionToken, onLogout }: { sessionToken: string; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [page, setPage] = useState<Page>('chat');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [memoryModal, setMemoryModal] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [rememberInSession, setRememberInSession] = useState(true);
  const [shareMemories, setShareMemories] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const title = useMemo(() => navItems.find(item => item.id === page)?.label ?? 'Your space', [page]);

  const changeMemoryPreference = (enabled: boolean) => {
    setRememberInSession(enabled);
    if (!enabled) setMemories([]);
  };

  const openMemory = (memory?: Memory) => {
    setEditing(memory ?? null);
    setMemoryDraft(memory?.text ?? '');
    setMemoryModal(true);
  };

  const saveMemory = () => {
    const value = memoryDraft.trim();
    if (!value) return;
    if (editing) {
      setMemories(current => current.map(item => item.id === editing.id ? { ...item, text: value } : item));
    } else {
      setMemories(current => [{ id: Date.now(), text: value, date: 'Added just now' }, ...current]);
    }
    setMemoryModal(false);
  };

  const removeMemory = (memory: Memory) => confirmAction(
    'Forget this memory?',
    'It will be removed from this session.',
    () => setMemories(current => current.filter(item => item.id !== memory.id)),
  );

  const confirmClear = () => confirmAction(
    'Clear this session?',
    'This removes the messages and memories currently shown in the app.',
    () => { setMessages([]); setMemories([]); setDraft(''); },
  );

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    const userMessage: Message = {
      id: Date.now(),
      text,
      author: 'you',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    setMessages(current => [...current, userMessage]);
    setDraft('');
    setIsSending(true);
    setChatError(null);

    try {
      const responseText = await gatewayService.sendChatMessage(text, messages.map(message => ({
        role: message.author === 'you' ? 'user' : 'assistant',
        content: message.text,
      })), sessionToken);

      const assistantMessage: Message = {
        id: Date.now() + 1,
        text: responseText,
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      };

      setMessages(current => [...current, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The conversation service is unavailable right now.';
      setChatError(message);
      setMessages(current => [...current, {
        id: Date.now() + 2,
        text: 'I couldn’t reach the conversation service right now. Please try again in a moment.',
        author: 'teddy',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: wide ? insets.bottom : 0 }]}>
      {wide && <Sidebar page={page} onNavigate={setPage} />}
      <View style={styles.main}>
        <View style={[styles.topbar, !wide && styles.mobileTopbar]}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>tb</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>teddy bud</Text>
            {!wide && <Text style={styles.brandSub}>{title}</Text>}
          </View>
          {wide && <Text style={styles.topbarContext}>{title}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Open privacy settings" onPress={() => setPage('privacy')} style={styles.profileButton}>
            <Text style={styles.profileInitial}>M</Text>
          </Pressable>
        </View>

        <View style={styles.contentArea}>
          {page === 'chat' && <ChatPage wide={wide} messages={messages} draft={draft} setDraft={setDraft} onSend={sendMessage} onClear={confirmClear} isSending={isSending} chatError={chatError} />}
          {page === 'memories' && <MemoriesPage wide={wide} memories={memories} memoryEnabled={rememberInSession} onAdd={() => openMemory()} onEdit={openMemory} onDelete={removeMemory} />}
          {page === 'privacy' && <PrivacyPage wide={wide} rememberInSession={rememberInSession} setRememberInSession={changeMemoryPreference} shareMemories={shareMemories} setShareMemories={setShareMemories} onClear={confirmClear} onLogout={onLogout} />}
        </View>
        {!wide && <BottomNav page={page} onNavigate={setPage} bottomInset={insets.bottom} />}
      </View>

      <Modal visible={memoryModal} animationType="fade" transparent onRequestClose={() => setMemoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopline}>
              <View style={styles.modalIcon}><Text style={styles.modalIconText}>✳</Text></View>
              <Pressable onPress={() => setMemoryModal(false)} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <Text style={styles.modalTitle}>{editing ? 'Edit a memory' : 'Keep a small thing in mind'}</Text>
            <Text style={styles.modalBody}>Only add something you would like Teddy Bud to remember during this session.</Text>
            <TextInput autoFocus value={memoryDraft} onChangeText={setMemoryDraft} placeholder="Write a gentle reminder…" placeholderTextColor={C.muted} multiline maxLength={180} style={styles.memoryInput} textAlignVertical="top" />
            <View style={styles.modalActions}>
              <Button label="Cancel" tone="quiet" onPress={() => setMemoryModal(false)} />
              <Button label={editing ? 'Save changes' : 'Add memory'} onPress={saveMemory} disabled={!memoryDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarBrand}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>tb</Text></View>
        <View><Text style={styles.brandName}>teddy bud</Text><Text style={styles.sidebarCaption}>A little room to breathe</Text></View>
      </View>
      <Text style={styles.sidebarLabel}>YOUR SPACE</Text>
      {navItems.map(item => <NavButton key={item.id} item={item} selected={item.id === page} onPress={() => onNavigate(item.id)} />)}
      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarRule} />
        <View style={styles.localNoteIcon}><Text style={styles.localNoteGlyph}>⌑</Text></View>
        <Text style={styles.localNoteTitle}>A quiet place, by design.</Text>
        <Text style={styles.localNoteBody}>Messages use the configured Teddy Bud gateway over HTTPS.</Text>
      </View>
    </View>
  );
}

function NavButton({ item, selected, onPress }: { item: (typeof navItems)[number]; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.navButton, selected && styles.navButtonSelected, pressed && styles.pressed]}>
    <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{item.icon}</Text><Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
    {selected && <View style={styles.navDot} />}
  </Pressable>;
}

function BottomNav({ page, onNavigate, bottomInset }: { page: Page; onNavigate: (page: Page) => void; bottomInset: number }) {
  return <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 8) }]}>{navItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === page }} onPress={() => onNavigate(item.id)} style={styles.bottomNavItem}>
    <Text style={[styles.bottomIcon, item.id === page && styles.bottomIconActive]}>{item.icon}</Text><Text style={[styles.bottomLabel, item.id === page && styles.bottomLabelActive]}>{item.label}</Text>
  </Pressable>)}</View>;
}

function ChatPage({ wide, messages, draft, setDraft, onSend, onClear, isSending, chatError }: { wide: boolean; messages: Message[]; draft: string; setDraft: (value: string) => void; onSend: () => void; onClear: () => void; isSending: boolean; chatError: string | null }) {
  const canSend = !!draft.trim() && !isSending;
  return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.chatHeader, wide && styles.chatHeaderWide]}>
      <View><Text style={styles.eyebrow}>A MOMENT FOR YOU</Text><Text style={styles.pageTitle}>How are you, really?</Text></View>
      <View style={styles.headerActions}><Pressable accessibilityRole="button" accessibilityLabel="Clear session" onPress={onClear} style={styles.moreButton}><Text style={styles.moreGlyph}>···</Text></Pressable></View>
    </View>
    <ScrollView style={styles.chatScroll} contentContainerStyle={[styles.chatContent, wide && styles.chatContentWide]} keyboardShouldPersistTaps="handled">
      <View style={styles.dayDivider}><View style={styles.dividerLine} /><Text style={styles.dayText}>TODAY</Text><View style={styles.dividerLine} /></View>
      <View style={styles.welcomeRow}>
        <View style={styles.teddyAvatar}><Text style={styles.teddyAvatarText}>tb</Text></View>
        <View style={styles.welcomeBubble}><Text style={styles.messageMeta}>YOUR SPACE · PRIVATE & SECURE</Text><Text style={styles.welcomeText}>Take a breath. You don’t have to have it all figured out to start.</Text><Text style={styles.welcomeHint}>What’s been on your mind lately?</Text></View>
      </View>
      {messages.map(message => <View key={message.id} style={[styles.messageRow, message.author === 'you' && styles.messageRowYou]}>
        {message.author === 'teddy' && <View style={styles.teddyAvatarSmall}><Text style={styles.teddyAvatarText}>tb</Text></View>}
        <View style={[styles.messageBubble, message.author === 'you' ? styles.userBubble : styles.teddyBubble]}><Text style={[styles.messageText, message.author === 'you' && styles.userMessageText]}>{message.text}</Text><Text style={[styles.messageTime, message.author === 'you' && styles.userMessageTime]}>{message.time}</Text></View>
      </View>)}
      {isSending && <View style={styles.sendingRow}><View style={styles.teddyAvatarSmall}><Text style={styles.teddyAvatarText}>tb</Text></View><View style={styles.typingBubble}><Text style={styles.typingText}>Thinking…</Text></View></View>}
      {chatError && <View style={styles.errorBanner}><Text style={styles.errorText}>{chatError}</Text></View>}
      {!wide && <View style={styles.promptWrap}><Text style={styles.promptHeading}>A gentle place to begin</Text><View style={styles.promptRow}><PromptChip label="A lot on my mind" onPress={() => setDraft('I have a lot on my mind today.')} /><PromptChip label="Help me unwind" onPress={() => setDraft('I could use a moment to unwind.')} /></View></View>}
    </ScrollView>
    <View style={[styles.composerWrap, wide && styles.composerWrapWide]}>
      <View style={[styles.composer, !canSend && styles.composerDisabled]}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Your words are welcome here…" placeholderTextColor={C.muted} multiline maxLength={2000} style={styles.composerInput} accessibilityLabel="Write a message" />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={onSend} disabled={!canSend} style={({ pressed }) => [styles.sendButton, canSend && styles.sendButtonActive, pressed && styles.pressed]}><Text style={[styles.sendGlyph, canSend && styles.sendGlyphActive]}>{isSending ? '…' : '↑'}</Text></Pressable>
      </View>
      <Text style={styles.composerFootnote}>{isSending ? 'Sending to the companion service…' : 'Messages stay in this session and are sent through the configured HTTPS gateway.'}</Text>
    </View>
  </KeyboardAvoidingView>;
}

function PromptChip({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.promptChip, pressed && styles.pressed]}><Text style={styles.promptChipText}>{label}</Text></Pressable>;
}

function MemoriesPage({ wide, memories, memoryEnabled, onAdd, onEdit, onDelete }: { wide: boolean; memories: Memory[]; memoryEnabled: boolean; onAdd: () => void; onEdit: (memory: Memory) => void; onDelete: (memory: Memory) => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>THE THINGS THAT MATTER</Text><Text style={styles.pageTitle}>Your memories</Text><Text style={styles.pageDescription}>Little details you choose to keep close. You can change or forget any of them, whenever you like.</Text></View>
    <View style={styles.memoryNotice}><View style={styles.noticeIcon}><Text style={styles.noticeGlyph}>⌑</Text></View><View style={styles.noticeCopy}><Text style={styles.noticeTitle}>{memoryEnabled ? 'Only for this session' : 'Session memories are off'}</Text><Text style={styles.noticeBody}>{memoryEnabled ? 'Memories are held in app state and clear when the app session ends. Secure saved storage is not connected yet.' : 'Turn on “Keep memories during this session” in Privacy settings to add memories.'}</Text></View></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>IN THIS SESSION <Text style={styles.countText}>{memories.length}</Text></Text><Pressable accessibilityRole="button" disabled={!memoryEnabled} onPress={onAdd} style={styles.addLink}><Text style={[styles.addLinkText, !memoryEnabled && styles.disabledText]}>{memoryEnabled ? '＋ Add a memory' : 'Memory is off'}</Text></Pressable></View>
    {memories.length ? memories.map(memory => <View key={memory.id} style={styles.memoryCard}><View style={styles.memoryMark}><Text style={styles.memoryMarkText}>✳</Text></View><View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.text}</Text><Text style={styles.memoryDate}>{memory.date}</Text></View><View style={styles.memoryActions}><Pressable accessibilityRole="button" accessibilityLabel="Edit memory" onPress={() => onEdit(memory)} style={styles.memoryAction}><Text style={styles.memoryActionGlyph}>✎</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Forget memory" onPress={() => onDelete(memory)} style={styles.memoryAction}><Text style={styles.deleteGlyph}>×</Text></Pressable></View></View>) : <View style={styles.emptyCard}><View style={styles.emptyMark}><Text style={styles.emptyGlyph}>✳</Text></View><Text style={styles.emptyTitle}>{memoryEnabled ? 'A fresh page' : 'Memories are off'}</Text><Text style={styles.emptyBody}>{memoryEnabled ? 'Nothing saved right now. Add a small detail you’d like to hold onto.' : 'Turn on session memories in Privacy settings when you are ready.'}</Text>{memoryEnabled && <Button label="Add your first memory" onPress={onAdd} />}</View>}
    {!!memories.length && <Text style={styles.memoriesFootnote}>Your memories are yours. Edit them, remove them, or clear this session at any time.</Text>}
  </ScrollView>;
}

function PrivacyPage({ wide, rememberInSession, setRememberInSession, shareMemories, setShareMemories, onClear, onLogout }: { wide: boolean; rememberInSession: boolean; setRememberInSession: (value: boolean) => void; shareMemories: boolean; setShareMemories: (value: boolean) => void; onClear: () => void; onLogout: () => void }) {
  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]}>
    <View style={styles.pageIntro}><Text style={styles.eyebrow}>YOUR CHOICES, ALWAYS</Text><Text style={styles.pageTitle}>Privacy & settings</Text><Text style={styles.pageDescription}>A few clear controls for what happens in your space.</Text></View>
    <View style={styles.privacyBanner}><View style={styles.privacyShield}><Text style={styles.shieldGlyph}>⌑</Text></View><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>You’re in control here</Text><Text style={styles.privacyBody}>Chat messages are sent to the configured HTTPS gateway. This web build keeps messages and memories in app memory for this session; encrypted storage is not configured.</Text></View></View>
    <Text style={styles.settingsSectionLabel}>YOUR SESSION</Text>
    <View style={styles.settingsCard}>
      <SettingRow icon="✳" title="Keep memories during this session" description="Let Teddy Bud use the memories you add while the app is open." value={rememberInSession} onChange={setRememberInSession} />
      <View style={styles.settingSeparator} />
      <SettingRow icon="↗" title="Share relevant memories" description="Allow relevant memories to be included when a conversation service is connected." value={shareMemories} onChange={setShareMemories} />
    </View>
    <Text style={styles.settingsSectionLabel}>DATA</Text>
    <View style={styles.settingsCard}>
      <View style={styles.clearRow}><View style={styles.clearIcon}><Text style={styles.clearGlyph}>⌫</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>Clear this session</Text><Text style={styles.settingDescription}>Remove the messages and memories currently on screen.</Text></View><Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable></View>
    </View>
    <View style={styles.settingsCard}><View style={styles.clearRow}><View style={styles.settingText}><Text style={styles.settingTitle}>Sign out</Text><Text style={styles.settingDescription}>End this Cloudflare Access session on this device.</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={styles.clearButton}><Text style={styles.clearButtonText}>Sign out</Text></Pressable></View></View>
    <Text style={styles.versionText}>TEDDY BUD  ·  PRIVATE BY DESIGN</Text>
  </ScrollView>;
}

function SettingRow({ icon, title, description, value, onChange }: { icon: string; title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.settingRow}><View style={styles.settingIcon}><Text style={styles.settingGlyph}>{icon}</Text></View><View style={styles.settingText}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={title} onPress={() => onChange(!value)} style={[styles.switchTrack, value && styles.switchOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></Pressable></View>;
}

function Button({ label, onPress, tone = 'primary', disabled = false }: { label: string; onPress: () => void; tone?: 'primary' | 'quiet'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, tone === 'quiet' && styles.buttonQuiet, disabled && styles.buttonDisabled, pressed && styles.pressed]}><Text style={[styles.buttonText, tone === 'quiet' && styles.buttonTextQuiet]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  authScreen: { flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', padding: 24 }, authCard: { width: '100%', maxWidth: 440, backgroundColor: C.paper, borderRadius: 28, padding: 30, borderWidth: 1, borderColor: C.line }, authMark: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, authEyebrow: { color: C.cocoa, fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 10 }, authTitle: { color: C.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center' }, authBody: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, marginBottom: 24 }, authButton: { minHeight: 52, borderRadius: 16, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, authButtonText: { color: C.white, fontSize: 13, fontWeight: '700' }, authFootnote: { color: '#9A8E82', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 14 }, authError: { backgroundColor: '#FCE9E3', borderRadius: 12, padding: 11, marginBottom: 14 }, authErrorText: { color: '#8D473F', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.canvas }, main: { flex: 1, minWidth: 0 },
  sidebar: { width: 264, backgroundColor: '#F2ECE3', borderRightWidth: 1, borderRightColor: C.line, paddingHorizontal: 22, paddingTop: 30, paddingBottom: 24 },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 46 }, brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: C.cocoa, justifyContent: 'center', alignItems: 'center' }, brandMarkText: { color: '#FFF9F3', fontSize: 18, fontWeight: '700', letterSpacing: -1 }, brandCopy: { justifyContent: 'center' }, brandName: { color: C.ink, fontSize: 16, letterSpacing: -0.4, fontWeight: '700' }, sidebarCaption: { color: C.muted, fontSize: 11, marginTop: 2 }, sidebarLabel: { color: '#A2968A', fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 12, marginLeft: 12 },
  navButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 12 }, navButtonSelected: { backgroundColor: '#E7DDD1' }, navIcon: { width: 22, textAlign: 'center', fontSize: 19, color: '#887C71' }, navIconSelected: { color: C.cocoa }, navLabel: { color: '#756A60', fontSize: 13, fontWeight: '500', flex: 1 }, navLabelSelected: { color: C.cocoaDark, fontWeight: '700' }, navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.cocoa },
  sidebarBottom: { marginTop: 'auto' }, sidebarRule: { height: 1, backgroundColor: '#E2D9CD', marginBottom: 20 }, localNoteIcon: { width: 32, height: 32, backgroundColor: '#E7DDD1', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, localNoteGlyph: { color: C.cocoa, fontSize: 17 }, localNoteTitle: { color: C.ink, fontSize: 12, fontWeight: '700', marginBottom: 5 }, localNoteBody: { color: C.muted, fontSize: 11, lineHeight: 17 },
  topbar: { height: 74, borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', backgroundColor: C.paper }, mobileTopbar: { height: 64, paddingHorizontal: 18 }, topbarContext: { marginLeft: 28, paddingLeft: 28, borderLeftWidth: 1, borderLeftColor: C.line, color: C.muted, fontSize: 13, flex: 1 }, profileButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }, profileInitial: { color: C.cocoaDark, fontSize: 13, fontWeight: '700' }, brandSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  contentArea: { flex: 1, minHeight: 0 }, chatPage: { flex: 1 }, chatHeader: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, chatHeaderWide: { paddingHorizontal: 48, paddingTop: 34 }, eyebrow: { color: C.cocoa, fontSize: 9, letterSpacing: 1.7, fontWeight: '700', marginBottom: 7 }, pageTitle: { color: C.ink, fontSize: 27, fontWeight: '600', letterSpacing: -0.8 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, servicePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 }, serviceDot: { width: 6, height: 6, backgroundColor: '#BC9E79', borderRadius: 4 }, serviceText: { color: C.muted, fontSize: 10, fontWeight: '600' }, moreButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }, moreGlyph: { color: C.muted, fontSize: 20, lineHeight: 23, marginTop: -10 },
  chatScroll: { flex: 1 }, chatContent: { paddingHorizontal: 20, paddingBottom: 18 }, chatContentWide: { maxWidth: 850, width: '100%', alignSelf: 'center', paddingHorizontal: 48 }, dayDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10, marginBottom: 21 }, dividerLine: { height: 1, backgroundColor: C.line, flex: 1 }, dayText: { color: '#A2968A', fontSize: 9, letterSpacing: 1.5, fontWeight: '700' }, welcomeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, teddyAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, teddyAvatarText: { color: '#FFF9F3', fontSize: 12, fontWeight: '700', letterSpacing: -0.4 }, welcomeBubble: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 5, borderTopRightRadius: 19, borderBottomRightRadius: 19, borderBottomLeftRadius: 19, paddingHorizontal: 17, paddingVertical: 15, maxWidth: 590, flex: 1 }, messageMeta: { color: '#A2968A', fontSize: 8, letterSpacing: 1.25, fontWeight: '700', marginBottom: 9 }, welcomeText: { color: C.ink, fontSize: 16, lineHeight: 25, letterSpacing: -0.1 }, welcomeHint: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  connectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2ECE3', borderRadius: 16, padding: 14, marginTop: 22, marginLeft: 44, gap: 12, maxWidth: 555 }, connectIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, connectIconText: { color: C.cocoa, fontSize: 17 }, connectCopy: { flex: 1 }, connectTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 4 }, connectBody: { fontSize: 11, color: C.muted, lineHeight: 16 }, connectArrow: { color: C.cocoa, fontSize: 24 }, promptWrap: { marginTop: 24 }, promptHeading: { color: C.muted, fontSize: 11, marginBottom: 10, marginLeft: 2 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, promptChip: { borderWidth: 1, borderColor: '#DED3C6', backgroundColor: C.paper, borderRadius: 18, paddingHorizontal: 13, minHeight: 36, justifyContent: 'center' }, promptChipText: { color: C.cocoaDark, fontSize: 11, fontWeight: '500' },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 14 }, messageRowYou: { justifyContent: 'flex-end' }, teddyAvatarSmall: { width: 27, height: 27, borderRadius: 10, backgroundColor: C.cocoa, alignItems: 'center', justifyContent: 'center' }, messageBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }, teddyBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderTopLeftRadius: 4 }, userBubble: { backgroundColor: C.cocoa, borderBottomRightRadius: 4 }, messageText: { color: C.ink, fontSize: 14, lineHeight: 21 }, userMessageText: { color: C.white }, messageTime: { color: C.muted, fontSize: 9, textAlign: 'right', marginTop: 5 }, userMessageTime: { color: '#E8D9CC' }, sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 }, typingBubble: { backgroundColor: C.paper, borderColor: C.line, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }, typingText: { color: C.muted, fontSize: 12, fontWeight: '600' }, errorBanner: { backgroundColor: '#FCE9E3', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 }, errorText: { color: '#8D473F', fontSize: 11, lineHeight: 16 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 10, backgroundColor: C.canvas }, composerWrapWide: { maxWidth: 850, width: '100%', alignSelf: 'center', paddingHorizontal: 48, paddingBottom: 18 }, composer: { minHeight: 53, maxHeight: 140, borderRadius: 18, borderWidth: 1, borderColor: '#DDD3C7', backgroundColor: C.paper, flexDirection: 'row', alignItems: 'flex-end', padding: 6, paddingLeft: 15 }, composerDisabled: { opacity: 0.76 }, composerInput: { flex: 1, color: C.ink, fontSize: 13, paddingTop: 12, paddingBottom: 10, maxHeight: 110, minHeight: 38 }, sendButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F0EBE4', justifyContent: 'center', alignItems: 'center' }, sendButtonActive: { backgroundColor: C.cocoa }, sendGlyph: { color: '#9A8E82', fontSize: 22, lineHeight: 26, fontWeight: '500' }, sendGlyphActive: { color: C.white }, composerFootnote: { color: '#9A8E82', fontSize: 9, textAlign: 'center', marginTop: 8, lineHeight: 14 },
  bottomNav: { height: 62, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, bottomNavItem: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }, bottomIcon: { fontSize: 19, color: '#9B9085', lineHeight: 22 }, bottomIconActive: { color: C.cocoa }, bottomLabel: { fontSize: 9, color: '#93877C', fontWeight: '500' }, bottomLabelActive: { color: C.cocoaDark, fontWeight: '700' },
  pageScroll: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 32 }, pageScrollWide: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 48, paddingTop: 38 }, pageIntro: { marginBottom: 22 }, pageDescription: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 9, maxWidth: 580 }, memoryNotice: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 16, backgroundColor: '#F1E9DE', marginBottom: 27 }, noticeIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#E7DDD1', alignItems: 'center', justifyContent: 'center' }, noticeGlyph: { fontSize: 17, color: C.cocoa }, noticeCopy: { flex: 1 }, noticeTitle: { color: C.cocoaDark, fontSize: 12, fontWeight: '700', marginBottom: 4 }, noticeBody: { color: '#796D62', fontSize: 11, lineHeight: 17 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#8E8175', fontSize: 10, letterSpacing: 1.3, fontWeight: '700' }, countText: { color: C.cocoa }, addLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }, addLinkText: { color: C.cocoa, fontSize: 12, fontWeight: '700' }, memoryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 10 }, memoryMark: { width: 32, height: 32, backgroundColor: C.peachLight, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryMarkText: { color: C.cocoa, fontSize: 16 }, memoryCopy: { flex: 1, paddingTop: 2 }, memoryText: { color: C.ink, fontSize: 13, lineHeight: 20 }, memoryDate: { color: '#9B9085', fontSize: 10, marginTop: 7 }, memoryActions: { flexDirection: 'row', gap: 3 }, memoryAction: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, memoryActionGlyph: { color: '#8A7D70', fontSize: 17 }, deleteGlyph: { color: '#A17C70', fontSize: 22 }, memoriesFootnote: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 10 }, emptyCard: { alignItems: 'center', backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 28, marginTop: 4 }, emptyMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, emptyGlyph: { color: C.cocoa, fontSize: 21 }, emptyTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, emptyBody: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 280, marginTop: 7, marginBottom: 17 },
  privacyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, backgroundColor: C.greenLight, borderRadius: 16, marginBottom: 27 }, privacyShield: { width: 35, height: 35, backgroundColor: '#D7E3D4', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, shieldGlyph: { color: C.green, fontSize: 19 }, privacyCopy: { flex: 1 }, privacyTitle: { color: '#435943', fontSize: 13, fontWeight: '700', marginBottom: 5 }, privacyBody: { color: '#65745F', fontSize: 11, lineHeight: 17 }, settingsSectionLabel: { color: '#8E8175', fontSize: 10, letterSpacing: 1.3, fontWeight: '700', marginBottom: 10, marginTop: 3 }, settingsCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 17, paddingHorizontal: 15, marginBottom: 23 }, settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }, settingIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.paperAlt, alignItems: 'center', justifyContent: 'center' }, settingGlyph: { color: C.cocoa, fontSize: 15 }, settingText: { flex: 1 }, settingTitle: { color: C.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 }, settingDescription: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, switchTrack: { width: 42, height: 25, borderRadius: 14, backgroundColor: '#DED8D0', padding: 3, justifyContent: 'center' }, switchOn: { backgroundColor: C.cocoa }, switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.white }, switchThumbOn: { alignSelf: 'flex-end' }, settingSeparator: { height: 1, backgroundColor: C.line, marginLeft: 44 }, gatewaySection: { borderRadius: 18 }, gatewaySectionFocused: { borderWidth: 1, borderColor: '#D6BAA5', padding: 10, marginHorizontal: -10, marginBottom: 14, backgroundColor: '#F8F0E8' }, gatewayIntro: { flexDirection: 'row', gap: 11, paddingTop: 16, paddingBottom: 14 }, gatewayIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, gatewayGlyph: { color: C.cocoa, fontSize: 16 }, inputLabel: { color: '#93877C', fontSize: 9, letterSpacing: 1.1, fontWeight: '700', marginBottom: 7 }, gatewayInput: { height: 45, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: '#FDFCFA', paddingHorizontal: 12, color: C.ink, fontSize: 12 }, gatewayActions: { paddingTop: 11, paddingBottom: 15, gap: 9 }, connectionStatus: { color: C.muted, fontSize: 10, lineHeight: 15 }, connectionReady: { color: C.green }, connectionError: { color: C.rose }, clearRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }, clearIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#F8EAE5', alignItems: 'center', justifyContent: 'center' }, clearGlyph: { color: C.rose, fontSize: 16 }, clearButton: { minHeight: 36, minWidth: 54, borderRadius: 11, borderWidth: 1, borderColor: '#E7D8D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, clearButtonText: { color: C.rose, fontSize: 11, fontWeight: '700' }, versionText: { textAlign: 'center', color: '#A79B8F', fontSize: 8, letterSpacing: 1.4, marginTop: 2, marginBottom: 16 },
  button: { minHeight: 42, backgroundColor: C.cocoa, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 }, buttonQuiet: { backgroundColor: '#F2ECE4' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: C.white, fontSize: 11, fontWeight: '700' }, buttonTextQuiet: { color: C.cocoaDark }, pressed: { opacity: 0.75 }, disabledText: { color: '#A79B8F' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(45, 36, 29, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 }, modalCard: { width: '100%', maxWidth: 460, backgroundColor: C.paper, borderRadius: 22, padding: 22 }, modalTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, modalIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.peachLight, alignItems: 'center', justifyContent: 'center' }, modalIconText: { color: C.cocoa, fontSize: 18 }, closeButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paperAlt }, closeText: { color: C.muted, fontSize: 22, lineHeight: 24 }, modalTitle: { color: C.ink, fontWeight: '700', fontSize: 20, letterSpacing: -0.4 }, modalBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 16 }, memoryInput: { minHeight: 100, maxHeight: 180, backgroundColor: '#F9F6F1', borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 13, color: C.ink, fontSize: 13, lineHeight: 19 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 17 },
});

export default App;

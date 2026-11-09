/**
 * Private, device-local wellbeing screens.
 * These screens own their editing state and receive persistence actions from the app shell.
 */
import React, { useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { RoundedText as Text, RoundedTextInput as TextInput } from '../components/RoundedText';
import { AppIcon } from '../components/AppIcon';
import { styles } from '../theme/appStyles';
import { EMOTION_AXES } from '../services/localData';
import type { EmotionCheckIn, JournalEntry } from '../services/localData';
import { savePlainTextFile } from '../services/backupFiles';
import { teddyTheme } from '../theme';

const C = {
  canvas: teddyTheme.colors.canvas, paper: teddyTheme.colors.surface, paperAlt: teddyTheme.colors.surfaceAlt, ink: teddyTheme.colors.text,
  muted: teddyTheme.colors.textSecondary, line: teddyTheme.colors.border, cocoa: teddyTheme.colors.primary, cocoaDark: teddyTheme.colors.onPrimaryContainer,
  peach: teddyTheme.colors.clay, peachLight: teddyTheme.colors.claySoft, green: teddyTheme.colors.success, greenLight: teddyTheme.colors.successContainer,
  rose: teddyTheme.colors.accentText, white: teddyTheme.colors.white,
};

/** Ask for confirmation using the platform-native interaction before destructive actions. */
function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert -- confirmation protects destructive local-data deletion.
    if (typeof window !== 'undefined' && window.confirm(`${title}\\n\\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

export function JournalPage({ wide, entries, onSave, onDelete, onShare }: {
  wide: boolean;
  entries: JournalEntry[];
  onSave: (entry: JournalEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShare: (entry: JournalEntry) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState('Free reflection');
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const prompts = ['Free reflection', 'What felt heavy today?', 'What is one small thing I appreciate?', 'What do I need more of right now?', 'What would I tell a friend in this situation?'];

  const save = async () => {
    const normalizedBody = body.trim();
    if (!normalizedBody || saving) {
      if (!normalizedBody) setActionError('Write a little in your entry before saving.');
      return;
    }
    const entry: JournalEntry = {
      id: editing ?? (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)),
      createdAt: editing ? (entries.find(item => item.id === editing)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      title: title.trim().slice(0, 160) || prompt,
      body: normalizedBody.slice(0, 30000),
      prompt,
    };
    setSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await onSave(entry);
      setTitle('');
      setBody('');
      setEditing(null);
      setPrompt('Free reflection');
      setActionNotice('Saved privately on this device.');
    } catch {
      setActionError('This entry could not be saved to this device. Your text is still in the editor; retry saving before leaving this page.');
    } finally {
      setSaving(false);
    }
  };

  const beginDelete = (entry: JournalEntry) => {
    confirmAction(
      'Delete journal entry?',
      `“${entry.title}” will be removed from this device. This cannot be undone.`,
      () => {
        setDeletingId(entry.id);
        setActionError(null);
        setActionNotice(null);
        onDelete(entry.id).then(() => {
          if (editing === entry.id) {
            setEditing(null);
            setTitle('');
            setBody('');
            setPrompt('Free reflection');
          }
        }).catch(() => {
          setActionError('This entry could not be deleted from saved data. The entry remains available; try again.');
        }).finally(() => setDeletingId(null));
      },
    );
  };

  const exportJournal = async () => {
    if (!entries.length || exporting) {
      if (!entries.length) setActionError('Write a journal entry before exporting.');
      return;
    }
    setExporting(true);
    setActionError(null);
    setActionNotice(null);
    const content = entries.map(entry => `# ${entry.title}\n${new Date(entry.createdAt).toLocaleString()} · ${entry.prompt}\n\n${entry.body}`).join('\n\n---\n\n');
    try {
      if (Platform.OS === 'web') {
        await savePlainTextFile(content, `teddy-bud-journal-${new Date().toISOString().slice(0, 10)}.txt`);
        setActionNotice('Your journal text download has started.');
      } else {
        const result = await Share.share({ title: 'Teddy Bud private journal export', message: content });
        setActionNotice(result.action === Share.dismissedAction
          ? 'Export canceled. Your journal entries remain saved on this device.'
          : 'The share sheet opened. Choose where you would like to keep your journal text.');
      }
    } catch {
      setActionError('Teddy Bud could not export the journal text. Try again, or select and copy the entries you want to keep.');
    } finally {
      setExporting(false);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setPrompt('Free reflection');
    setActionError(null);
    setActionNotice(null);  };
  const visible = entries.filter(entry => (entry.title + ' ' + entry.body + ' ' + entry.prompt).toLowerCase().includes(search.toLowerCase()));

  return <ScrollView contentContainerStyle={[styles.pageScroll, wide && styles.pageScrollWide]} keyboardShouldPersistTaps="handled">
    <View style={styles.pageIntro}>
      <Text style={styles.eyebrow}>PRIVATE REFLECTION</Text>
      <Text style={styles.pageTitle}>A page just for you</Text>
      <Text style={styles.pageDescription}>Your journal stays in this device's local app storage. It is never added to Teddy's context unless you choose “Discuss with Teddy” and then send the prepared message yourself.</Text>
    </View>
    {(actionError || actionNotice) && <View accessibilityRole={actionError ? 'alert' : 'summary'} style={actionError ? styles.authError : styles.journalNotice}>
      <Text accessibilityLiveRegion="polite" style={actionError ? styles.authErrorText : styles.journalNoticeText}>{actionError || actionNotice}</Text>
      {actionError && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss journal notice" onPress={() => setActionError(null)} style={styles.journalDismiss}><Text style={styles.journalDismissText}>Dismiss</Text></Pressable>}
    </View>}
    <View style={styles.journalEditorCard}>
      <Text style={styles.sectionTitle}>{editing ? 'Edit your entry' : 'Write a little'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.journalPrompts}>{prompts.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: prompt === value }} onPress={() => { setPrompt(value); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [styles.journalPromptChip, prompt === value && styles.journalPromptChipSelected, pressed && styles.pressed]}><Text style={styles.journalPromptText}>{value}</Text></Pressable>)}</ScrollView>
      <TextInput accessibilityLabel="Journal title (optional)" value={title} onChangeText={setTitle} maxLength={160} placeholder="Title (optional)" placeholderTextColor={C.muted} style={styles.journalTextInput} editable={!saving} />
      <TextInput accessibilityLabel="Journal entry" accessibilityHint="Your entry is stored locally and is not sent to the AI unless you choose to discuss it and then send the prepared chat message." value={body} onChangeText={value => { setBody(value); setActionError(null); setActionNotice(null); }} maxLength={30000} multiline placeholder="Start wherever you are…" placeholderTextColor={C.muted} style={[styles.journalTextInput, styles.journalBodyInput]} editable={!saving} textAlignVertical="top" />
      <View style={styles.journalEditorActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save journal changes' : 'Save privately'} disabled={saving} onPress={save} style={({ pressed }) => [styles.journalSaveButton, saving && styles.buttonDisabled, pressed && styles.pressed]}>
          <Text style={styles.journalSaveButtonText}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save privately'}</Text>
        </Pressable>
        {editing && <Pressable accessibilityRole="button" disabled={saving} onPress={cancelEdit} style={({ pressed }) => [styles.journalCancelButton, pressed && styles.pressed]}><Text style={styles.journalCancelButtonText}>Cancel edit</Text></Pressable>}
      </View>
    </View>
    <Pressable accessibilityRole="button" disabled={exporting} onPress={exportJournal} style={({ pressed }) => [styles.journalExportButton, exporting && styles.buttonDisabled, pressed && styles.pressed]}>
      <Text style={styles.journalExportButtonText}>{exporting ? 'Preparing export…' : 'Export journal text'}</Text>
    </Pressable>
    <TextInput accessibilityLabel="Search journal entries" value={search} onChangeText={setSearch} placeholder="Search journal entries" placeholderTextColor={C.muted} style={styles.journalSearchInput} />
    {visible.map(entry => <View key={entry.id} style={styles.journalEntryCard}>
      <Text style={styles.journalEntryTitle}>{entry.title}</Text>
      <Text style={styles.journalEntryMeta}>{new Date(entry.createdAt).toLocaleString()} · {entry.prompt}</Text>
      <View style={styles.journalEntryActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit journal entry ${entry.title}`} disabled={saving || deletingId !== null} onPress={() => { setTitle(entry.title); setBody(entry.body); setPrompt(entry.prompt); setEditing(entry.id); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [styles.journalInlineButton, pressed && styles.pressed]}>
          <Text style={styles.journalInlineButtonText}>Edit entry</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Discuss journal entry ${entry.title} with Teddy`} onPress={() => {
          confirmAction('Share this entry with Teddy?', 'The entry will be copied into your chat draft. It will not be sent until you review it and tap Send.', () => onShare(entry));
        }} style={({ pressed }) => [styles.journalInlineButton, pressed && styles.pressed]}>
          <Text style={styles.journalInlineButtonText}>Discuss with Teddy</Text>
        </Pressable>
      </View>
      <Text selectable style={styles.journalEntryBody}>{entry.body}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete journal entry ${entry.title}`} disabled={deletingId !== null} onPress={() => beginDelete(entry)} style={({ pressed }) => [styles.journalDeleteButton, deletingId === entry.id && styles.buttonDisabled, pressed && styles.pressed]}>
        <Text style={styles.journalDeleteButtonText}>{deletingId === entry.id ? 'Deleting…' : 'Delete'}</Text>
      </Pressable>
    </View>)}
    {visible.length === 0 && <Text style={styles.journalEmptyText}>{search ? 'No entries match your search.' : 'Your journal is empty. Write a little whenever you are ready.'}</Text>}
  </ScrollView>;
}
export function EmotionsPage({ wide, entries, onSave, onDelete }: { wide: boolean; entries: EmotionCheckIn[]; onSave: (entry: EmotionCheckIn) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const __teddyBudExtractedStyles14 = StyleSheet.create({
    style0: ({maxWidth:760,width:'100%',alignSelf:'center'}) as const,
    style1: ({fontSize:wide?30:25,fontWeight:'700',color:C.cocoaDark}) as const,
    style2: ({fontSize:14,lineHeight:21,color:C.muted,marginTop:8}) as const,
    style3: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:24,padding:16,marginTop:20}) as const,
    style4: ({fontSize:17,fontWeight:'700',color:C.cocoaDark}) as const,
    style5: ({textAlign:'center',fontSize:13,lineHeight:19,color:C.muted,marginTop:2}) as const,
    style6: ({fontSize:11,lineHeight:16,color:C.muted,textAlign:'center',marginTop:5}) as const,
    style7: ({fontSize:13,lineHeight:20,color:C.cocoaDark,marginTop:8}) as const,
    style8: ({color:'#FFFFFF',fontWeight:'700'}) as const,
    style9: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:22,padding:16,marginTop:14}) as const,
    style10: ({fontSize:19,fontWeight:'700',color:C.cocoaDark,marginBottom:6}) as const,
    style11: ({fontSize:13,color:C.muted,marginBottom:12}) as const,
    style12: ({color:C.cocoaDark,fontWeight:'600',marginTop:14}) as const,
    style13: ({flexDirection:'row',gap:8,marginTop:8}) as const,
    style14: ({color:C.cocoaDark,fontWeight:'600',marginTop:14,marginBottom:8}) as const,
    style15: ({flexDirection:'row',flexWrap:'wrap',gap:8}) as const,
    style16: ({fontSize:12,color:C.muted,marginTop:12}) as const,
    style17: ({minHeight:76,borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,color:C.cocoaDark,marginTop:7,textAlignVertical:'top'}) as const,
    style18: ({color:'#FFFFFF',fontWeight:'700'}) as const,
    style19: ({backgroundColor:C.paper,borderColor:C.line,borderWidth:1,borderRadius:18,padding:15,marginTop:18}) as const,
    style20: ({fontSize:16,fontWeight:'700',color:C.cocoaDark}) as const,
    style21: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style22: ({fontSize:14,color:C.cocoaDark,marginTop:10}) as const,
    style23: ({fontSize:14,color:C.cocoaDark,marginTop:6}) as const,
    style24: ({fontSize:13,color:C.muted,marginTop:6}) as const,
    style25: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style26: ({backgroundColor:'#F4ECE6',borderRadius:18,padding:15,marginTop:18}) as const,
    style27: ({fontSize:16,fontWeight:'700',color:C.cocoaDark}) as const,
    style28: ({fontSize:13,color:C.muted,lineHeight:20,marginTop:6}) as const,
    style29: ({fontSize:19,fontWeight:'700',color:C.cocoaDark,marginTop:24,marginBottom:10}) as const,
    style30: ({color:C.muted,paddingVertical:14}) as const,
    style31: ({fontSize:12,color:C.muted,lineHeight:18,marginTop:10}) as const,
  });
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [energy, setEnergy] = useState(3);
  const [support, setSupport] = useState<EmotionCheckIn['support']>('listen');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const latest = entries[0];

  const resetForm = () => {
    setRatings({});
    setEnergy(3);
    setSupport('listen');
    setNote('');
    setShowForm(false);
  };

  const hasUnsavedCheckIn = Object.keys(ratings).length > 0 || Boolean(note.trim()) || energy !== 3 || support !== 'listen';

  const toggleForm = () => {
    if (!showForm) {
      setShowForm(true);
      setActionError(null);
      setActionNotice(null);
      return;
    }
    if (hasUnsavedCheckIn) {
      confirmAction('Discard this check-in?', 'Your unfinished ratings and note will be discarded.', resetForm);
    } else {
      setShowForm(false);
    }
  };

  const saveCheckIn = async () => {
    if (saving) return;
    const entry: EmotionCheckIn = {
      id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      emotions: ratings,
      energy,
      support,
      origin: 'self',
      ...(note.trim() ? { note: note.trim().slice(0, 2000) } : {}),
    };
    setSaving(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await onSave(entry);
      resetForm();
      setActionNotice('Check-in saved privately on this device.');
    } catch {
      setActionError('This check-in could not be saved. Your ratings and note are still here; retry saving before leaving this screen.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCheckIn = (entry: EmotionCheckIn) => {
    confirmAction('Delete check-in?', 'This removes this entry from this device.', () => {
      setDeletingId(entry.id);
      setActionError(null);
      setActionNotice(null);
      onDelete(entry.id).then(() => {
        setActionNotice('Check-in deleted from this device.');
      }).catch(() => {
        setActionError('This check-in could not be deleted from saved data. The entry is still available; try again.');
      }).finally(() => setDeletingId(null));
    });
  };
  const weekEntries = entries.filter(entry => { const age = Date.now() - new Date(entry.createdAt).getTime(); return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000; });
  const weekEnergy = weekEntries.length ? weekEntries.reduce((sum, entry) => sum + entry.energy, 0) / weekEntries.length : 0;
  const weekEmotionAverages = EMOTION_AXES.map(axis => {
    const rated = weekEntries.filter(entry => typeof entry.emotions[axis.id] === 'number');
    return { label: axis.label, average: rated.length ? rated.reduce((sum, entry) => sum + (entry.emotions[axis.id] ?? 0), 0) / rated.length : null, count: rated.length };
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  const axisCount = EMOTION_AXES.length;
  const size = wide ? 340 : 290;
  const center = size / 2;
  const radius = size * 0.34;
  const point = (axis: number, value: number) => {
    const angle = -Math.PI / 2 + axis * Math.PI * 2 / axisCount;
    return { x: center + Math.cos(angle) * radius * value / 5, y: center + Math.sin(angle) * radius * value / 5 };
  };
  const line = (a: {x:number;y:number}, b: {x:number;y:number}, color: string, width = 1) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const __teddyBudExtractedStyles10 = StyleSheet.create({
      style0: ({ position: 'absolute', left: (a.x+b.x)/2-Math.sqrt(dx*dx+dy*dy)/2, top: (a.y+b.y)/2-width/2, width: Math.sqrt(dx*dx+dy*dy), height: width, backgroundColor: color, transform: [{ rotate: Math.atan2(dy,dx)+'rad' }] }) as const,
    });
    return <View key={color + a.x + a.y + b.x + b.y} pointerEvents="none" style={__teddyBudExtractedStyles10.style0} />;
  };
  const webBounce = useRef(new Animated.Value(1)).current;
  const curvedRing = (level: number, color: string, strokeWidth: number) => {
    const ringPoints = EMOTION_AXES.map((_, i) => point(i, level));
    return ringPoints.map((a, i) => {
      const b = ringPoints[(i + 1) % axisCount]!;
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const control = { x: midpoint.x + (center - midpoint.x) * 0.34, y: midpoint.y + (center - midpoint.y) * 0.34 };
      const samples = [0.25, 0.5, 0.75, 1].map(t => ({
        x: (1-t)*(1-t)*a.x + 2*(1-t)*t*control.x + t*t*b.x,
        y: (1-t)*(1-t)*a.y + 2*(1-t)*t*control.y + t*t*b.y,
      }));
      const chain = [a, ...samples];
      return chain.slice(0, -1).map((from, segment) => line(from, chain[segment + 1]!, color, strokeWidth));
    });
  };
  const renderWeb = (data?: Record<string, number>) => {
    const __teddyBudExtractedStyles11 = StyleSheet.create({
      style0: ({ width: size, height: size, alignSelf: 'center' }) as const,
      style1: ({ width: size, height: size, position: 'relative', transform: [{ scale: webBounce }] }) as const,
      style2: ({ position: 'absolute', left: center-radius*0.86, top: center-radius*0.86, width: radius*1.72, height: radius*1.72, borderRadius: radius, backgroundColor: 'rgba(150, 108, 78, 0.10)', borderWidth: 1, borderColor: 'rgba(150, 108, 78, 0.10)' }) as const,
      style3: ({position:'absolute',left:center-4,top:center-4,width:8,height:8,borderRadius:4,backgroundColor:'#9A765D'}) as const,
    });
    const values = EMOTION_AXES.map(axis => data?.[axis.id] ?? 0);
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emotion web. Touch to feel the web gently bounce."
      accessibilityHint="The connected emotion web responds with a soft elastic movement."
      onPressIn={() => Animated.spring(webBounce, { toValue: 0.965, useNativeDriver: true, speed: 1.1, bounciness: 8 }).start()}
      onPressOut={() => Animated.sequence([
        Animated.spring(webBounce, { toValue: 1.035, useNativeDriver: true, speed: 0.45, bounciness: 10 }),
        Animated.spring(webBounce, { toValue: 1, useNativeDriver: true, speed: 0.65, bounciness: 5 }),
      ]).start()}
      style={__teddyBudExtractedStyles11.style0}
    >
      <Animated.View style={__teddyBudExtractedStyles11.style1}>
        <View pointerEvents="none" style={__teddyBudExtractedStyles11.style2} />
        {[1,2,3,4,5].map(level => <React.Fragment key={'ring-'+level}>{curvedRing(level, level===5?'#D5C1B2':'#E5D8CE', level===5?1.4:1)}</React.Fragment>)}
        {EMOTION_AXES.map((_, i) => line({x:center,y:center}, point(i,5), '#D5C5B8', 1))}
        {EMOTION_AXES.map((axis,i) => {
          const label = point(i,5.75);
          const dot = point(i,5);
          const __teddyBudExtractedStyles12 = StyleSheet.create({
            style0: ({position:'absolute',left:label.x-37,top:label.y-9,width:74,textAlign:'center',fontSize:10,fontWeight:'600',color:C.cocoaDark}) as const,
            style1: ({position:'absolute',left:dot.x-4,top:dot.y-4,width:8,height:8,borderRadius:4,backgroundColor:'#9A765D',borderWidth:1.5,borderColor:'#FFF9F4'}) as const,
          });
          return <React.Fragment key={axis.id}>
            <Text style={__teddyBudExtractedStyles12.style0}>{axis.label}</Text>
            <View pointerEvents="none" style={__teddyBudExtractedStyles12.style1} />
          </React.Fragment>;
        })}
        {data ? values.map((value,i) => {
          const a = point(i,value);
          const b = point((i+1)%axisCount,values[(i+1)%axisCount]!);
          const midpoint = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          const control = {x:midpoint.x+(center-midpoint.x)*0.28,y:midpoint.y+(center-midpoint.y)*0.28};
          const samples = [0.2,0.4,0.6,0.8,1].map(t=>({x:(1-t)*(1-t)*a.x+2*(1-t)*t*control.x+t*t*b.x,y:(1-t)*(1-t)*a.y+2*(1-t)*t*control.y+t*t*b.y}));          return <React.Fragment key={'data-'+i}>{[a,...samples].slice(0,-1).map((from,j)=>line(from,samples[j]!, '#A86F52', 2.6))}</React.Fragment>;
        }) : null}
        {data ? values.map((value,i) => {
          const __teddyBudExtractedStyles13 = StyleSheet.create({
            style0: ({position:'absolute',left:point(i,value).x-5,top:point(i,value).y-5,width:10,height:10,borderRadius:5,backgroundColor:'#A86F52',borderWidth:2,borderColor:'#FFF9F4'}) as const,
          });
          return value>0 ? <View key={'value-'+i} pointerEvents="none" style={__teddyBudExtractedStyles13.style0} /> : null;
        }) : null}
        <View pointerEvents="none" style={__teddyBudExtractedStyles11.style3} />
      </Animated.View>
    </Pressable>;
  };
  return <ScrollView contentContainerStyle={[styles.emotionsPageScroll, wide && styles.emotionsPageScrollWide]}>
    <View style={__teddyBudExtractedStyles14.style0}>
      <Text style={__teddyBudExtractedStyles14.style1}>Your emotional landscape</Text>
      <Text style={__teddyBudExtractedStyles14.style2}>A private snapshot of how you feel. Rate only what feels relevant; there is no good or bad shape.</Text>
      {(actionError || actionNotice) && <View accessibilityRole={actionError ? 'alert' : 'summary'} style={actionError ? styles.authError : styles.journalNotice}>
        <Text accessibilityLiveRegion="polite" style={actionError ? styles.authErrorText : styles.journalNoticeText}>{actionError || actionNotice}</Text>
        {actionError && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss check-in notice" onPress={() => setActionError(null)} style={styles.journalDismiss}><Text style={styles.journalDismissText}>Dismiss</Text></Pressable>}
      </View>}
      <View style={__teddyBudExtractedStyles14.style3}>
        <Text style={__teddyBudExtractedStyles14.style4}>{latest?.origin === 'survey-ai' ? 'Your starting emotion web' : latest ? 'Latest check-in' : 'Your emotion web'}</Text>
        {renderWeb(latest?.emotions)}
        <Text accessibilityRole="text" style={__teddyBudExtractedStyles14.style5}>{latest ? (latest.origin === 'survey-ai' ? 'AI-estimated from your onboarding answers · '+new Date(latest.createdAt).toLocaleString() : 'Self-rated snapshot · '+new Date(latest.createdAt).toLocaleString()) : 'Your web appears after your first check-in.'}</Text>
        {latest?.origin === 'survey-ai' ? <Text style={__teddyBudExtractedStyles14.style6}>A gentle estimate from your answers, not a clinical assessment. You can replace it with your own check-in at any time.</Text> : null}
        {latest ? <Text style={__teddyBudExtractedStyles14.style7}>Highest ratings: {EMOTION_AXES.filter(a=>(latest.emotions[a.id]??0)>0).sort((a,b)=>(latest.emotions[b.id]??0)-(latest.emotions[a.id]??0)).slice(0,3).map(a=>a.label+' '+latest.emotions[a.id]+'/5').join(' · ') || 'No emotions rated'} · Energy {latest.energy}/5</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={showForm ? 'Close check-in form' : 'Add a check-in'} onPress={toggleForm} style={({ pressed }) => [{ minHeight:48, backgroundColor:C.cocoaDark, borderRadius:15, padding:14, alignItems:'center', justifyContent:'center', marginTop:16 }, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles14.style8}>{showForm?'Close check-in':'Add a check-in'}</Text></Pressable>
      </View>
      {showForm ? <View style={__teddyBudExtractedStyles14.style9}>
        <Text style={__teddyBudExtractedStyles14.style10}>How are you feeling?</Text>
        <Text style={__teddyBudExtractedStyles14.style11}>Tap a number from 0 (not present) to 5 (very strong). You can leave any emotion unrated.</Text>
        {EMOTION_AXES.map(axis=>{
          const __teddyBudExtractedStyles15 = StyleSheet.create({
            style0: ({paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.line}) as const,
            style1: ({color:C.cocoaDark,fontWeight:'600',marginBottom:8}) as const,
            style2: ({flexDirection:'row',gap:8}) as const,
          });
          return <View key={axis.id} style={__teddyBudExtractedStyles15.style0}>
          <Text style={__teddyBudExtractedStyles15.style1}>{axis.label}</Text>
          <View style={__teddyBudExtractedStyles15.style2}>{[0,1,2,3,4,5].map(n=>{
            const __teddyBudExtractedStyles16 = StyleSheet.create({
              style0: ({flex:1,minWidth:30,height:48,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:ratings[axis.id]===n?'#B87862':'#F5ECE5',borderWidth:ratings[axis.id]===n?2:0,borderColor:C.cocoaDark}) as const,
              style1: ({color:C.cocoaDark,fontWeight:'600'}) as const,
            });
            return <Pressable key={n} accessibilityRole="button" accessibilityLabel={axis.label+' '+n+' out of 5'} accessibilityState={{ selected: ratings[axis.id] === n }} onPress={()=>{ setRatings(current=>({...current,[axis.id]:n})); setActionError(null); setActionNotice(null); }} style={__teddyBudExtractedStyles16.style0}><Text style={__teddyBudExtractedStyles16.style1}>{n}</Text></Pressable>;
          })}</View>
        </View>;
        })}
        <Text style={__teddyBudExtractedStyles14.style12}>Energy: {energy}/5</Text>
        <View style={__teddyBudExtractedStyles14.style13}>{[0,1,2,3,4,5].map(n=>{
          const __teddyBudExtractedStyles17 = StyleSheet.create({
            style0: ({flex:1,minWidth:30,height:48,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:energy===n?'#B87862':'#F5ECE5'}) as const,
            style1: ({color:C.cocoaDark}) as const,
          });
          return <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Energy ${n} out of 5`} accessibilityState={{ selected: energy === n }} onPress={()=>{ setEnergy(n); setActionError(null); setActionNotice(null); }} style={__teddyBudExtractedStyles17.style0}><Text style={__teddyBudExtractedStyles17.style1}>{n}</Text></Pressable>;
        })}</View>
        <Text style={__teddyBudExtractedStyles14.style14}>What would help right now?</Text>
        <View style={__teddyBudExtractedStyles14.style15}>{([{id:'listen',label:'Just listen'},{id:'advice',label:'Practical advice'},{id:'encouragement',label:'Encouragement'},{id:'unsure',label:'Not sure'}] as const).map(option=>{
          const __teddyBudExtractedStyles18 = StyleSheet.create({
            style0: ({color:C.cocoaDark}) as const,
          });
          return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: support === option.id }} onPress={()=>{ setSupport(option.id); setActionError(null); setActionNotice(null); }} style={({ pressed }) => [{ minHeight:48, paddingVertical:9, paddingHorizontal:12, borderRadius:14, backgroundColor:support===option.id?'#E7D0C2':'#F5ECE5', borderWidth:support===option.id?1:0, borderColor:'#B87862' }, pressed && styles.pressed, pressed && styles.squeezePressed]}><Text style={__teddyBudExtractedStyles18.style0}>{option.label}</Text></Pressable>;
        })}</View>
        <Text style={__teddyBudExtractedStyles14.style16}>Optional note (saved only on this device)</Text>
        <TextInput accessibilityLabel="Emotion check-in note (optional)" value={note} onChangeText={value => { setNote(value.slice(0, 2000)); setActionError(null); setActionNotice(null); }} multiline maxLength={2000} placeholder="Anything you want to remember about this moment…" placeholderTextColor={C.muted} style={__teddyBudExtractedStyles14.style17} />
        <Pressable accessibilityRole="button" accessibilityLabel="Save emotion check-in" disabled={saving} onPress={saveCheckIn} style={({ pressed }) => [{ minHeight:48, backgroundColor:C.cocoaDark, borderRadius:15, padding:14, alignItems:'center', justifyContent:'center', marginTop:14 }, saving && styles.buttonDisabled, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles14.style18}>{saving ? 'Saving check-in…' : 'Save privately on this device'}</Text></Pressable>
      </View> : null}
      <View style={__teddyBudExtractedStyles14.style19}>
        <Text style={__teddyBudExtractedStyles14.style20}>Your week in reflection</Text>
        {weekEntries.length >= 2 ? <>
          <Text style={__teddyBudExtractedStyles14.style21}>A local summary of {weekEntries.length} check-ins from the last seven days. This uses only ratings you entered and is not a diagnosis or prediction.</Text>
          <Text style={__teddyBudExtractedStyles14.style22}>Average energy: {weekEnergy.toFixed(1)}/5</Text>
          {typeof weekEmotionAverages[0]?.average === 'number' ? <Text style={__teddyBudExtractedStyles14.style23}>Most frequently highest-rated emotion: {weekEmotionAverages[0].label} ({weekEmotionAverages[0].average?.toFixed(1)}/5 across {weekEmotionAverages[0].count} rated check-ins).</Text> : <Text style={__teddyBudExtractedStyles14.style24}>No emotion ratings were recorded in these check-ins.</Text>}
        </> : <Text style={__teddyBudExtractedStyles14.style25}>Add at least two check-ins within seven days to see a summary. It stays on this device and never labels or scores your mental health.</Text>}
      </View>
      <View style={__teddyBudExtractedStyles14.style26}>
        <Text style={__teddyBudExtractedStyles14.style27}>Your recent pattern</Text>
        <Text style={__teddyBudExtractedStyles14.style28}>Based on your latest {Math.min(entries.length,7)} check-ins. Unrated emotions remain visible as “Not rated”; these averages are not a diagnosis or prediction.</Text>
        {EMOTION_AXES.map(axis=>{const sample=entries.slice(0,7).filter(entry=>typeof entry.emotions[axis.id]==='number');const avg=sample.length ? sample.reduce((sum,entry)=>sum+(entry.emotions[axis.id]??0),0)/sample.length : 0;const __teddyBudExtractedStyles19 = StyleSheet.create({
          style0: ({marginTop:9}) as const,
          style1: ({flexDirection:'row',justifyContent:'space-between'}) as const,
          style2: ({fontSize:12,color:C.cocoaDark}) as const,
          style3: ({fontSize:12,color:C.cocoaDark}) as const,
          style4: ({height:6,backgroundColor:'#E1D5CC',borderRadius:4,marginTop:4,overflow:'hidden'}) as const,
          style5: ({height:6,width:`${(avg/5*100)}%` as `${number}%`,backgroundColor:'#B87862',borderRadius:4}) as const,
        });
        return <View key={axis.id} style={__teddyBudExtractedStyles19.style0}><View style={__teddyBudExtractedStyles19.style1}><Text style={__teddyBudExtractedStyles19.style2}>{axis.label}</Text><Text style={__teddyBudExtractedStyles19.style3}>{sample.length ? `${avg.toFixed(1)}/5` : 'Not rated'}</Text></View><View style={__teddyBudExtractedStyles19.style4}><View style={__teddyBudExtractedStyles19.style5} /></View></View>;})}
      </View>
      <Text style={__teddyBudExtractedStyles14.style29}>Past check-ins</Text>
      {entries.length===0 ? <Text style={__teddyBudExtractedStyles14.style30}>Nothing recorded yet. Your check-ins are optional and stay in local app storage.</Text> : entries.map(entry=>{
        const __teddyBudExtractedStyles20 = StyleSheet.create({
          style0: ({backgroundColor:C.paper,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginBottom:9}) as const,
          style1: ({color:C.cocoaDark,fontWeight:'700'}) as const,
          style2: ({color:C.muted,fontSize:13,marginTop:5}) as const,
          style3: ({color:C.cocoaDark,marginTop:6}) as const,
          style4: ({color:C.rose,fontWeight:'600'}) as const,
        });
        return <View key={entry.id} style={__teddyBudExtractedStyles20.style0}>
        <Text style={__teddyBudExtractedStyles20.style1}>{new Date(entry.createdAt).toLocaleString()}</Text>
        <Text style={__teddyBudExtractedStyles20.style2}>{EMOTION_AXES.filter(a=>entry.emotions[a.id]!==undefined).sort((a,b)=>(entry.emotions[b.id]??0)-(entry.emotions[a.id]??0)).slice(0,4).map(a=>a.label+' '+entry.emotions[a.id]+'/5').join(' · ') || 'No emotion ratings'} · Energy {entry.energy}/5</Text>
        {entry.note ? <Text style={__teddyBudExtractedStyles20.style3}>{entry.note}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete check-in from ${new Date(entry.createdAt).toLocaleString()}`} disabled={deletingId !== null} onPress={()=>deleteCheckIn(entry)} style={({ pressed }) => [{ minHeight:48, alignSelf:'flex-end', justifyContent:'center', paddingHorizontal:12 }, deletingId === entry.id && styles.buttonDisabled, pressed && styles.pressed]}><Text style={__teddyBudExtractedStyles20.style4}>{deletingId === entry.id ? 'Deleting…' : 'Delete'}</Text></Pressable>
      </View>;
      })}
      <Text style={__teddyBudExtractedStyles14.style31}>These ratings are self-reported reflections, not a clinical assessment. No emotions are inferred from your chats.</Text>
    </View>
  </ScrollView>;
}

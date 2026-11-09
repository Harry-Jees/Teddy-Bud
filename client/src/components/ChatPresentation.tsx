/**
 * Lightweight chat presentation primitives.
 * Keep message formatting and response feedback separate from app orchestration.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Linking, Platform, View } from 'react-native';
import { RoundedText as Text } from './RoundedText';
import { styles } from '../theme/appStyles';

function openExternalUrl(url: string): Promise<void> {
  const desktop = typeof window !== 'undefined' ? window.teddyBudDesktop : undefined;
  return desktop ? desktop.openExternal(url) : Linking.openURL(url);
}

export function MarkdownReply({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^\s*(```|~~~)/.test(line)) {
      const fence = line.trim().slice(0, 3);
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith(fence)) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<Text key={`code-${index}`} style={styles.markdownFence}>{code.join('\n')}</Text>);
      continue;
    }
    const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<Text key={`heading-${index}`} style={[styles.messageText, styles.markdownHeading, heading[1].length === 1 && styles.markdownHeadingLarge]}>{renderInlineMarkdown(heading[2])}</Text>);
      index += 1;
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<View key={`rule-${index}`} style={styles.markdownRule} />);
      index += 1;
      continue;
    }
    const list = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[2]);
      let number = Number(list[2] ?? 1);
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
        if (!item || Boolean(item[2]) !== ordered) break;
        blocks.push(<View key={`list-${index}`} style={styles.markdownListRow}><Text style={styles.messageText}>{ordered ? `${number++}.` : '\u2022'}</Text><Text style={[styles.messageText, styles.markdownListText]}>{renderInlineMarkdown(item[3])}</Text></View>);
        index += 1;
      }
      continue;
    }
    if (/^\s*&gt;|^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      blocks.push(<View key={`quote-${index}`} style={styles.markdownQuote}><Text style={styles.messageText}>{renderInlineMarkdown(quote.join(' '))}</Text></View>);
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^\s*(?:#{1,3}\s|```|~~~|>|([-*+]|\d+[.)])\s|---+\s*$)/.test(lines[index])) paragraph.push(lines[index++].trim());
    blocks.push(<Text key={`paragraph-${index}`} style={styles.messageText}>{renderInlineMarkdown(paragraph.join(' '))}</Text>);
  }
  return <View style={styles.markdownReply}>{blocks}</View>;
}

function renderInlineMarkdown(value: string): React.ReactNode[] {
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(\*\*|__)(.+?)\3|~~(.+?)~~|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const current = match;
    if (current.index > cursor) result.push(value.slice(cursor, current.index));
    if (current[1] && current[2]) {
      const url = current[2];
      result.push(<Text key={`link-${current.index}`} accessibilityRole="link" style={styles.markdownLink} onPress={() => openExternalUrl(url).catch(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') Alert.alert('Could not open this link', 'Copy it and try again in your browser.');
        else Alert.alert('Could not open link', 'Copy the link and try again in your browser.');
      })}>{current[1]}</Text>);
    } else if (current[4] !== undefined) result.push(<Text key={`strong-${current.index}`} style={styles.markdownStrong}>{current[4]}</Text>);
    else if (current[5] !== undefined) result.push(<Text key={`strike-${current.index}`} style={styles.markdownStrike}>{current[5]}</Text>);
    else if (current[6] !== undefined) result.push(<Text key={`italic-${current.index}`} style={styles.markdownItalic}>{current[6]}</Text>);
    else if (current[7] !== undefined) result.push(<Text key={`italic-${current.index}`} style={styles.markdownItalic}>{current[7]}</Text>);
    else if (current[8] !== undefined) result.push(<Text key={`inline-code-${current.index}`} style={styles.markdownInlineCode}>{current[8]}</Text>);
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

export function TypingIndicator() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {
      if (mounted) setReduceMotion(false);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web' || reduceMotion) return;
    const animations = dots.map((dot, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 150),
      Animated.timing(dot, { toValue: 1, duration: 240, useNativeDriver: false, isInteraction: false }),
      Animated.timing(dot, { toValue: 0, duration: 240, useNativeDriver: false, isInteraction: false }),
      Animated.delay((dots.length - index - 1) * 150),
    ])));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [dots, reduceMotion]);

  return <View accessibilityRole="progressbar" accessibilityLabel="Teddy Bud is responding" accessibilityLiveRegion="polite" style={styles.typingIndicator}>
    {dots.map((dot, index) => Platform.OS === 'web'
      ? <View key={index} {...({ dataSet: { typingDot: 'true' } } as Record<string, unknown>)} style={styles.typingDot} />
      : reduceMotion ? <View key={index} style={styles.typingDot} /> : <Animated.View
        key={index}
        style={[styles.typingDot, { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}
      />)}
  </View>;
}

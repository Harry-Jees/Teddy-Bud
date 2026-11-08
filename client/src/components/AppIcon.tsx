import React from 'react';
import {
  ArrowRight, BookOpen, Check, ChevronRight, Cloud, Ellipsis, Eye, EyeOff,
  Heart, History, Image, Info, Pencil, Plus, Search, Share2, ShieldCheck,
  Sparkles, Sun, Trash2, X,
} from 'lucide-react-native';

export type AppIconName =
  | 'sparkle' | 'edit' | 'close' | 'chevron' | 'info' | 'book'
  | 'heart' | 'plus' | 'shield' | 'search' | 'trash' | 'check'
  | 'arrow' | 'sun' | 'cloud' | 'history' | 'image' | 'share' | 'menu' | 'eye' | 'eyeOff';

type Props = { name: AppIconName; color?: string; size?: number };

const ICONS = {
  sparkle: Sparkles,
  edit: Pencil,
  close: X,
  chevron: ChevronRight,
  info: Info,
  book: BookOpen,
  heart: Heart,
  plus: Plus,
  shield: ShieldCheck,
  search: Search,
  trash: Trash2,
  check: Check,
  arrow: ArrowRight,
  sun: Sun,
  cloud: Cloud,
  history: History,
  image: Image,
  share: Share2,
  menu: Ellipsis,
  eye: Eye,
  eyeOff: EyeOff,
} as const;

export function AppIcon({ name, color = '#685443', size = 18 }: Props) {
  const Icon = ICONS[name];
  return <Icon color={color} size={size} strokeWidth={1.8} />;
}

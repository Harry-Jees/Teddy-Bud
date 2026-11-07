import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

export type AppIconName =
  | 'sparkle' | 'edit' | 'close' | 'chevron' | 'info' | 'book'
  | 'heart' | 'plus' | 'shield' | 'search' | 'trash' | 'check'
  | 'arrow' | 'sun' | 'history' | 'image' | 'share' | 'menu';

type Props = { name: AppIconName; color?: string; size?: number };

export function AppIcon({ name, color = '#685443', size = 18 }: Props) {
  const common = { backgroundColor: color } as const;
  const line = (style: ViewStyle, key: string) => <View key={key} style={[styles.line, common, style]} />;
  const ring = (style: ViewStyle, key: string) => <View key={key} style={[styles.ring, { borderColor: color }, style]} />;
  let parts: React.ReactNode;
  switch (name) {
    case 'sparkle':
      parts = <>{line({ width: 2, height: size * .72, left: size * .44, top: size * .14 }, 'v')}{line({ width: size * .72, height: 2, left: size * .14, top: size * .48 }, 'h')}{line({ width: 1.5, height: size * .34, left: size * .79, top: size * .02 }, 'sv')}{line({ width: size * .34, height: 1.5, left: size * .64, top: size * .18 }, 'sh')}</>;
      break;
    case 'edit':
      parts = <>{line({ width: size * .62, height: 3, left: size * .19, top: size * .43, transform: [{ rotate: '-45deg' }] }, 'p')}{line({ width: size * .19, height: 3, left: size * .12, top: size * .78, transform: [{ rotate: '-45deg' }] }, 't')}{line({ width: size * .2, height: 2, left: size * .1, top: size * .83 }, 'b')}</>;
      break;
    case 'close':
      parts = <>{line({ width: size * .78, height: 2, left: size * .11, top: size * .46, transform: [{ rotate: '45deg' }] }, 'a')}{line({ width: size * .78, height: 2, left: size * .11, top: size * .46, transform: [{ rotate: '-45deg' }] }, 'b')}</>;
      break;
    case 'chevron':
      parts = <>{line({ width: size * .42, height: 2, left: size * .28, top: size * .31, transform: [{ rotate: '45deg' }] }, 'a')}{line({ width: size * .42, height: 2, left: size * .28, top: size * .61, transform: [{ rotate: '-45deg' }] }, 'b')}</>;
      break;
    case 'info':
      parts = <>{ring({ width: size * .82, height: size * .82, left: size * .09, top: size * .09, borderWidth: 1.6 }, 'r')}{line({ width: 2, height: size * .31, left: size * .48, top: size * .42 }, 'i')}{ring({ width: 2.5, height: 2.5, left: size * .46, top: size * .23, borderWidth: 0, backgroundColor: color }, 'd')}</>;
      break;
    case 'book':
      parts = <>{ring({ width: size * .72, height: size * .82, left: size * .14, top: size * .09, borderWidth: 1.7, borderRadius: 3 }, 'r')}{line({ width: 1.5, height: size * .65, left: size * .35, top: size * .17 }, 's')}{line({ width: size * .28, height: 1.4, left: size * .48, top: size * .38 }, 'l1')}{line({ width: size * .22, height: 1.4, left: size * .48, top: size * .55 }, 'l2')}</>;
      break;
    case 'heart':
      parts = <>{ring({ width: size * .44, height: size * .44, left: size * .17, top: size * .19, borderWidth: 1.7, borderRadius: size, transform: [{ rotate: '-45deg' }] }, 'a')}{ring({ width: size * .44, height: size * .44, left: size * .39, top: size * .19, borderWidth: 1.7, borderRadius: size, transform: [{ rotate: '45deg' }] }, 'b')}{line({ width: size * .52, height: 1.7, left: size * .24, top: size * .58, transform: [{ rotate: '45deg' }] }, 'c')}</>;
      break;
    case 'plus':
      parts = <>{line({ width: size * .72, height: 2, left: size * .14, top: size * .46 }, 'h')}{line({ width: 2, height: size * .72, left: size * .46, top: size * .14 }, 'v')}</>;
      break;
    case 'shield':
      parts = <>{ring({ width: size * .66, height: size * .78, left: size * .17, top: size * .08, borderWidth: 1.8, borderRadius: 5, transform: [{ rotate: '45deg' }] }, 's')}{line({ width: size * .25, height: 1.7, left: size * .37, top: size * .52, transform: [{ rotate: '45deg' }] }, 'c1')}{line({ width: size * .32, height: 1.7, left: size * .47, top: size * .43, transform: [{ rotate: '-45deg' }] }, 'c2')}</>;
      break;
    case 'search':
      parts = <>{ring({ width: size * .55, height: size * .55, left: size * .08, top: size * .08, borderWidth: 1.8 }, 'r')}{line({ width: size * .36, height: 2, left: size * .55, top: size * .65, transform: [{ rotate: '45deg' }] }, 'h')}</>;
      break;
    case 'trash':
      parts = <>{ring({ width: size * .54, height: size * .6, left: size * .23, top: size * .29, borderWidth: 1.6, borderRadius: 3 }, 'b')}{line({ width: size * .68, height: 1.8, left: size * .16, top: size * .2 }, 'l')}{line({ width: size * .28, height: 1.8, left: size * .36, top: size * .1 }, 't')}</>;
      break;
    case 'check':
      parts = <>{line({ width: size * .35, height: 2, left: size * .12, top: size * .55, transform: [{ rotate: '45deg' }] }, 'a')}{line({ width: size * .58, height: 2, left: size * .34, top: size * .43, transform: [{ rotate: '-48deg' }] }, 'b')}</>;
      break;
    case 'arrow':
      parts = <>{line({ width: size * .66, height: 1.8, left: size * .1, top: size * .47 }, 'h')}{line({ width: size * .32, height: 1.8, left: size * .56, top: size * .34, transform: [{ rotate: '45deg' }] }, 'a')}{line({ width: size * .32, height: 1.8, left: size * .56, top: size * .58, transform: [{ rotate: '-45deg' }] }, 'b')}</>;
      break;
    case 'sun':
      parts = <>{ring({ width: size * .38, height: size * .38, left: size * .31, top: size * .31, borderWidth: 1.7 }, 'c')}{[0,45,90,135].map((angle,i)=>line({ width: 1.6, height: size * .2, left: size * .47, top: size * .02, transform: [{ rotate: angle+'deg' }] }, 'ray'+i))}</>;
      break;
    case 'history':
      parts = <>{ring({ width: size * .78, height: size * .78, left: size * .11, top: size * .11, borderWidth: 1.7 }, 'r')}{line({ width: 1.7, height: size * .25, left: size * .49, top: size * .25 }, 'h')}{line({ width: size * .23, height: 1.7, left: size * .49, top: size * .48 }, 'm')}</>;
      break;
    case 'image':
      parts = <>{ring({ width: size * .82, height: size * .66, left: size * .09, top: size * .17, borderWidth: 1.7, borderRadius: 3 }, 'r')}{ring({ width: size * .17, height: size * .17, left: size * .24, top: size * .28, borderWidth: 1.4 }, 'c')}{line({ width: size * .42, height: 1.6, left: size * .42, top: size * .62, transform: [{ rotate: '-30deg' }] }, 'm')}</>;
      break;
    case 'share':
      parts = <>{ring({ width: size * .2, height: size * .2, left: size * .08, top: size * .4, borderWidth: 1.6 }, 'a')}{ring({ width: size * .2, height: size * .2, left: size * .7, top: size * .12, borderWidth: 1.6 }, 'b')}{ring({ width: size * .2, height: size * .2, left: size * .7, top: size * .7, borderWidth: 1.6 }, 'c')}{line({ width: size * .55, height: 1.6, left: size * .2, top: size * .35, transform: [{ rotate: '-25deg' }] }, 'l1')}{line({ width: size * .55, height: 1.6, left: size * .2, top: size * .63, transform: [{ rotate: '25deg' }] }, 'l2')}</>;
      break;
    case 'menu':
      parts = <>{[0,1,2].map(i=>line({ width: size * .7, height: 1.8, left: size * .15, top: size * (.25+i*.25) }, 'l'+i))}</>;
      break;
  }
  return <View accessible={false} style={{ width: size, height: size }}>{parts}</View>;
}

const styles = StyleSheet.create({
  line: { position: 'absolute', borderRadius: 2 },
  ring: { position: 'absolute', borderWidth: 1.5, borderRadius: 99 },
});

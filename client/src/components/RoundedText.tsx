import React from 'react';
import { Platform, Text as NativeText } from 'react-native';

type Props = React.ComponentProps<typeof NativeText>;

export function RoundedText({ style, ...props }: Props) {
  return <NativeText {...props} style={[{ fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : undefined }, style]} />;
}

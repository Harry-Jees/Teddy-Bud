import React from 'react';
import { Platform, Text as NativeText, TextInput as NativeTextInput } from 'react-native';

type TextProps = React.ComponentProps<typeof NativeText>;
type TextInputProps = React.ComponentProps<typeof NativeTextInput>;

const roundedFont = { fontFamily: Platform.OS === 'android' ? 'sans-serif-rounded' : undefined };

export function RoundedText({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[roundedFont, style]} />;
}

export function RoundedTextInput({ style, ...props }: TextInputProps) {
  return <NativeTextInput {...props} style={[roundedFont, style]} />;
}

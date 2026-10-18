import { crisisHelplineOptionForLocale, emergencyCallOptionForLocale, hasCrisisSignal } from '../src/services/conversationSafety';

describe('crisis signal prompts', () => {
  test.each([
    'I want to die.',
    "I'm thinking about hurting myself.",
    'I already overdosed.',
    'My friend says they want to die.',
    'I might hurt someone.',
    "I can't keep myself safe.",
  ])('flags a direct risk signal: %s', message => {
    expect(hasCrisisSignal(message)).toBe(true);
  });

  test.each([
    'I am writing an essay about suicide prevention.',
    'I watched a movie about self-harm.',
    "I'm not suicidal.",
    'I feel sad about moving to another city.',
  ])('does not flag ordinary or explicitly negated language: %s', message => {
    expect(hasCrisisSignal(message)).toBe(false);
  });
});

describe('emergency call options', () => {
  test.each([
    ['en-IN', { number: '112', region: 'India' }],
    ['en-US', { number: '911', region: 'United States' }],
    ['en-CA', { number: '911', region: 'Canada' }],
    ['en-GB', { number: '999', region: 'United Kingdom' }],
    ['en-AU', { number: '000', region: 'Australia' }],
    ['en-NZ', { number: '111', region: 'New Zealand' }],
    ['de-DE', { number: '112', region: 'European Union' }],
    ['en-Latn-IN', { number: '112', region: 'India' }],
    ['en-US-u-ca-gregory', { number: '911', region: 'United States' }],
  ])('provides a call option for the %s device region', (locale, expected) => {
    expect(emergencyCallOptionForLocale(locale)).toEqual(expected);
  });

  test('does not guess an emergency number for an unsupported or regionless locale', () => {
    expect(emergencyCallOptionForLocale('en')).toBeNull();
    expect(emergencyCallOptionForLocale('en-JP')).toBeNull();
  });
});

describe('crisis helpline options', () => {
  test.each([
    ['en-US', { number: '988', name: '988 Lifeline', region: 'United States', textNumber: '988', website: 'https://988lifeline.org/' }],
    ['en-CA', { number: '988', name: '988 Suicide Crisis Helpline', region: 'Canada', textNumber: '988', website: 'https://988.ca/' }],
    ['en-Latn-US', { number: '988', name: '988 Lifeline', region: 'United States', textNumber: '988', website: 'https://988lifeline.org/' }],
    ['fr-CA-u-ca-gregory', { number: '988', name: '988 Suicide Crisis Helpline', region: 'Canada', textNumber: '988', website: 'https://988.ca/' }],
    ['en-IN', { number: '14416', name: 'Tele-MANAS', region: 'India', alternateCall: { number: '18008914416', label: '1-800 891 4416' }, website: 'https://telemanas.mohfw.gov.in/' }],
    ['hi-IN', { number: '14416', name: 'Tele-MANAS', region: 'India', alternateCall: { number: '18008914416', label: '1-800 891 4416' }, website: 'https://telemanas.mohfw.gov.in/' }],
    ['en-Latn-IN-u-ca-gregory', { number: '14416', name: 'Tele-MANAS', region: 'India', alternateCall: { number: '18008914416', label: '1-800 891 4416' }, website: 'https://telemanas.mohfw.gov.in/' }],
  ])('provides a verified crisis helpline option for the %s device region', (locale, expected) => {
    expect(crisisHelplineOptionForLocale(locale)).toEqual(expected);
  });

  test.each(['en', 'en-GB', 'en-GB-u-ca-US'])('does not guess a 988 service for unsupported or regionless locale %s', locale => {
    expect(crisisHelplineOptionForLocale(locale)).toBeNull();
  });
});

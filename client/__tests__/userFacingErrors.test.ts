import { chatErrorMessage, localDataErrorMessage } from '../src/services/userFacingErrors';

describe('safe chat error messages', () => {
  test('explains exhausted credits separately from temporary service throttling', () => {
    expect(chatErrorMessage(Object.assign(new Error('private backend details'), {
      status: 429,
      code: 'DAILY_CREDITS_EXHAUSTED',
    }))).toMatch(/40 chat credits/i);
    expect(chatErrorMessage(Object.assign(new Error('provider detail'), { status: 429 })))
      .toMatch(/usage limit/i);
  });

  test('explains oversized messages and attachments', () => {
    expect(chatErrorMessage(Object.assign(new Error('secret API response'), { status: 413 })))
      .toMatch(/too large to send/i);
  });

  test('never displays raw server messages for unexpected failures', () => {
    const error = Object.assign(new Error('internal upstream hostname and stack trace'), { status: 502 });
    const message = chatErrorMessage(error);
    expect(message).toMatch(/could not complete this reply/i);
    expect(message).not.toMatch(/upstream hostname|stack trace/i);
  });

  test('gives a useful action for connection failures without showing transport details', () => {
    const message = chatErrorMessage(new TypeError('failed to fetch internal-host.local:8080'));
    expect(message).toMatch(/check your internet connection/i);
    expect(message).not.toMatch(/internal-host|8080/i);
  });
});

describe('safe local-data error messages', () => {
  test('does not expose database errors or stack details', () => {
    const message = localDataErrorMessage(new Error('SQLiteNativeStackTrace: private internals'), 'save');
    expect(message).toMatch(/could not be saved/i);
    expect(message).not.toMatch(/SQLiteNativeStackTrace|private internals/i);
  });

  test('gives a storage-space recovery step without suggesting destructive clearing', () => {
    const message = localDataErrorMessage(new Error('ENOSPC quota exceeded'), 'save');
    expect(message).toMatch(/free up space/i);
    expect(message).not.toMatch(/clear your saved data as a troubleshooting step/i);
  });

  test('keeps local data failures recoverable and encourages retry', () => {
    expect(localDataErrorMessage(new Error('SQLITE_BUSY'), 'load')).toMatch(/retry/i);
  });
});

type ErrorShape = {
  status?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
};

function errorShape(error: unknown): ErrorShape {
  return error && typeof error === 'object' ? error as ErrorShape : {};
}

export function chatErrorMessage(error: unknown): string {
  const shape = errorShape(error);
  const status = typeof shape.status === 'number' ? shape.status : undefined;
  const code = typeof shape.code === 'string' ? shape.code : '';
  const detail = error instanceof Error ? error.message : '';
  const name = typeof shape.name === 'string' ? shape.name : '';

  if ((typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError')
    || name === 'AbortError' || /timed out|timeout/i.test(detail)) {
    return 'The conversation service took too long to respond. Check your connection and try again.';
  }
  if (/failed to fetch|network request failed|fetch failed|load failed|networkerror|offline/i.test(detail) || error instanceof TypeError) {
    return "Teddy Bud couldn't connect to the conversation service. Check your internet connection and try again. Your message remains visible in this chat.";
  }
  if (status === 401) return 'Your sign-in has expired. Please sign in again.';
  if (code === 'DAILY_CREDITS_EXHAUSTED') return 'You have used today’s 40 chat credits. They reset at 00:00 UTC.';
  if (code === 'DAILY_BACKGROUND_TASKS_EXHAUSTED') return 'The daily limit for background tasks has been reached. Please try again tomorrow.';
  if (status === 429) return 'The conversation service is busy or you have reached a usage limit. Please wait a moment and try again.';
  if (status === 413) return 'This message or image is too large to send. Shorten the text or choose a smaller image and try again.';
  if (status === 400 || status === 422) return 'This message could not be sent as provided. Check the text or attachment and try again.';
  if (status === 403) return 'This request is not available for the current account. Check your account status or try again later.';
  if (status === 404) return 'The requested conversation service or model is not available right now. Please try again later.';
  if (typeof status === 'number' && status >= 500) {
    return 'Teddy Bud could not complete this reply. Your message remains visible in this chat; please try again shortly.';
  }
  return 'Teddy Bud could not complete this request. Your message remains visible in this chat; please try again.';
}

export type LocalDataOperation = 'load' | 'save' | 'clear';

export function localDataErrorMessage(error: unknown, operation: LocalDataOperation = 'save'): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : '';
  if (/quota|storage full|enospc|not enough space/.test(detail)) {
    return 'This device may be low on storage. Free up space and retry; do not clear your saved data as a troubleshooting step.';
  }
  if (/corrupt|malformed|invalid saved data|migration/.test(detail)) {
    return 'Teddy Bud could not read part of the saved data safely. Retry once; if the problem continues, make a backup or contact support before clearing anything.';
  }
  if (/locked|busy|temporarily unavailable/.test(detail)) {
    return 'Your private data store is temporarily busy. Wait a moment and retry.';
  }
  if (/could not clear|failed to clear|could not delete|failed to remove/.test(detail)) {
    return 'Teddy Bud could not finish clearing this device’s saved data. Retry only if you still intend to remove it.';
  }
  if (operation === 'load') {
    return 'Teddy Bud could not open the saved data on this device. Retry local storage. Your data has not been intentionally deleted.';
  }
  if (operation === 'clear') {
    return 'Teddy Bud could not finish clearing this device’s saved data. Retry only if you still intend to remove it.';
  }
  return 'This change could not be saved to this device. Your current screen may be ahead of the saved data; retry saving before leaving this session.';
}

export function backupErrorMessage(error: unknown, operation: 'export' | 'import'): string {
  const message = error instanceof Error ? error.message : '';
  const safeKnownError = /^(Secure backup encryption is unavailable|A signed-in account is required|Choose a backup passphrase|This device data is too large|This backup is larger|Sign in to the account that owns|Enter the 12-character-or-longer|That file is not a supported|Backup encoding is invalid|Backup data is incomplete|Backup chat selection is invalid|A saved chat in this backup is invalid|A saved memory in this backup is invalid|Backup settings are invalid|The selected chat in this backup is missing|The backup cryptographic fields have invalid lengths|This backup belongs to a different account|The backup could not be unlocked)/i.test(message);
  if (safeKnownError) return message;
  if (operation === 'export') {
    return 'Teddy Bud could not create the encrypted backup. Check available storage and secure-backup support, then try again.';
  }
  return 'Teddy Bud could not complete the restore safely. Review the backup file and passphrase, then retry. Do not clear local data as a troubleshooting step.';
}

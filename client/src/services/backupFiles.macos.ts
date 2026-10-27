export async function savePlainTextFile(_contents: string, _filename: string): Promise<boolean> {
  throw new Error('Text file export is not available in this app build. Use the desktop app’s supported export flow.');
}

export async function saveBackupFile(): Promise<boolean> {
  throw new Error('Open the browser app on this Mac to export or import backups.');
}

export async function pickBackupFile(): Promise<string | null> {
  throw new Error('Open the browser app on this Mac to export or import backups.');
}

// Web and other non-Android platforms do not schedule native Android reminders.
export async function requestCareReminderPermission(): Promise<boolean> {
  return false;
}

export async function scheduleCareReminder(): Promise<boolean> {
  return false;
}

export async function cancelCareReminder(): Promise<void> {
  // No native reminder is scheduled on this platform.
}

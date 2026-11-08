import notifee, { AndroidImportance, AuthorizationStatus, TriggerType } from '@notifee/react-native';

const REMINDER_ID = 'teddy-bud-gentle-check-in';
const CHANNEL_ID = 'gentle-check-ins';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const CHECK_INS = [
  'Hey bro! Everything okay? 😊',
  'Hey buddy, how have you been? 💛',
  'Bro, just checking in. Doing alright? 🌻',
  "Hey! Haven't seen you around lately. All good? 🧸",
  "Take a little breather, buddy. We're here for you 🌿",
  "How's life treating you today? ☀️",
];

function notificationsAllowed(status: number) {
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

export async function requestCareReminderPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return notificationsAllowed(settings.authorizationStatus);
}

export async function scheduleCareReminder(lastActiveAt = Date.now()): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  if (!notificationsAllowed(settings.authorizationStatus)) {
    await notifee.cancelNotification(REMINDER_ID);
    return false;
  }

  const channelId = await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Gentle check-ins',
    description: 'Occasional friendly check-ins from Teddy Bud',
    importance: AndroidImportance.DEFAULT,
    vibration: false,
  });

  await notifee.cancelNotification(REMINDER_ID);
  const messageIndex = Math.floor(lastActiveAt / THREE_DAYS_MS) % CHECK_INS.length;
  await notifee.createTriggerNotification(
    {
      id: REMINDER_ID,
      title: 'Hey bro! 💛',
      body: CHECK_INS[messageIndex],
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        color: '#75513D',
        autoCancel: true,
        pressAction: { id: 'default' },
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: lastActiveAt + THREE_DAYS_MS,
    },
  );
  return true;
}

export async function cancelCareReminder(): Promise<void> {
  await notifee.cancelNotification(REMINDER_ID);
}

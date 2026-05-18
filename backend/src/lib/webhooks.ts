import { env } from '../config/env';

export async function sendSlackNotification(text: string, blocks?: object[]) {
  if (!env.SLACK_WEBHOOK_URL) return;
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...(blocks ? { blocks } : {}) }),
  });
}

export async function sendTeamsNotification(title: string, text: string) {
  if (!env.TEAMS_WEBHOOK_URL) return;
  await fetch(env.TEAMS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '0076D7',
      summary: title,
      sections: [{ activityTitle: title, activityText: text }],
    }),
  });
}

export async function notify(title: string, message: string) {
  await Promise.allSettled([
    sendSlackNotification(`*${title}*\n${message}`),
    sendTeamsNotification(title, message),
  ]);
}

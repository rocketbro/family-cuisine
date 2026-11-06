// What the evening notification says. Extras are easy to forget about, and a made one is pantry
// that has to come off, so it asks about them by name.

export function checkinNotice(extras: readonly string[]): { title: string; body: string } {
  const title = 'What did you make today?';
  if (!extras.length) return { title, body: 'Tell us what you ate, and we’ll keep the pantry right.' };
  return { title, body: `Tell us what you ate and whether you made ${spokenList(extras)}, and we’ll keep the pantry right.` };
}

function spokenList(items: readonly string[]): string {
  if (items.length < 3) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

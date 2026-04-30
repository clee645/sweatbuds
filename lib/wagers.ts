export type WagerRule = {
  quantity: number;
  text: string;
  emoji: string;
};

export const DEFAULT_WAGER: WagerRule = {
  quantity: 1,
  text: 'Romantic Favor',
  emoji: '😉',
};

export const PRESET_WAGERS: WagerRule[] = [
  { quantity: 1, text: 'Romantic Favor', emoji: '😉' },
  { quantity: 1, text: 'Dinner', emoji: '🍽️' },
  { quantity: 10, text: '$', emoji: '💵' },
  { quantity: 1, text: 'Massage', emoji: '😺' },
];

export function formatWager(w: WagerRule): string {
  const emoji = w.emoji ? ` ${w.emoji}` : '';
  if (w.text === '$') return `$${w.quantity}${emoji}`;
  return `${w.quantity} ${w.text}${emoji}`;
}

export function wagersEqual(a: WagerRule, b: WagerRule): boolean {
  return a.quantity === b.quantity && a.text === b.text && a.emoji === b.emoji;
}

export function isPreset(w: WagerRule): boolean {
  return PRESET_WAGERS.some((p) => wagersEqual(p, w));
}

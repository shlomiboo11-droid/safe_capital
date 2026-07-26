// A1#12 / A4#10 — the ONE place error text becomes Hebrew.
//
// Before this file the translation lived twice inside index.js (topic discovery
// and the SSE error event), and every other screen showed the raw server string
// ("שגיאה: Server error"). Two copies of the same sentences means the next
// person fixes one and misses the other — so both moved here and everything
// else now calls in.
//
// Pure functions: string in, string out. No DOM, no network, no store.

// Order matters — the FIRST match wins. 'Session not found or not ready' must
// stay above 'Session not found', otherwise the generic line swallows it.
const KNOWN = [
  { re: /credit balance is too low/i,
    he: 'אזל הקרדיט בחשבון Anthropic — כנס ל-https://console.anthropic.com/settings/billing, טען קרדיט ונסה שוב.' },
  { re: /rate.?limit/i,
    he: 'הגעת ל-rate limit של Anthropic. המתן כדקה ונסה שוב.' },
  { re: /session not found or not ready/i,
    he: 'הסשן כבר עבר את השלב הזה.' },
  { re: /session not found/i,
    he: 'הסשן כבר לא קיים — ייתכן שנמחק.' },
  { re: /failed to fetch|networkerror|load failed/i,
    he: 'אין חיבור לשרת — בדוק את האינטרנט ונסה שוב.' },
  { re: /^server error$/i,
    he: 'שגיאת שרת — נסה שוב עוד רגע.' },
  { re: /^request failed$/i,
    he: 'הבקשה נכשלה — נסה שוב.' }
];

// Returns the Hebrew sentence for a known failure, or null when we don't
// recognise the message. Kept separate so the two wrappers below can choose
// what to do with "unknown" without duplicating the table.
export function knownHebrewError(msg) {
  const text = String(msg || '');
  for (const entry of KNOWN) {
    if (entry.re.test(text)) return entry.he;
  }
  return null;
}

// For alert()/notice sites: ALWAYS Hebrew. The original text is kept in
// parentheses on purpose — losing it would make a new failure undiagnosable.
export function toHebrewError(msg) {
  const known = knownHebrewError(msg);
  if (known) return known;
  const raw = String(msg || '').trim();
  return raw
    ? 'הפעולה נכשלה — נסה שוב (' + raw + ')'
    : 'הפעולה נכשלה — נסה שוב.';
}

// For the chat-bubble notices that already build a sentence around the message
// ("המחקר נעצר: …"). An unknown message stays as-is so the wrapper sentence
// doesn't end up nested inside a second one.
export function friendlyClaudeError(msg) {
  return knownHebrewError(msg) || (String(msg || '').trim() || 'שגיאה לא ידועה');
}

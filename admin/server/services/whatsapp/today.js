/**
 * The current date, phrased for a Hebrew prompt.
 *
 * Without this the model falls back on the "now" it absorbed during training,
 * which is always in the past. That is not a cosmetic slip: research queries
 * came out asking for forecasts about a year that had already ended, and the
 * web_search that followed went looking for stale news.
 *
 * Every prompt builder that asks the model to reason about "recent", "this
 * week", "current" or any year must include this line.
 */

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

/**
 * @param {Date} [now] Injectable for tests; defaults to the real clock.
 * @returns {string} e.g. "תאריך היום: 27 ביולי 2026 (יולי 2026)."
 */
function todayLine(now = new Date()) {
  const day = now.getDate();
  const month = MONTHS_HE[now.getMonth()];
  const year = now.getFullYear();
  return `תאריך היום: ${day} ב${month} ${year} (${month} ${year}).`;
}

/**
 * A fuller block for prompts that drive a web search, where "recent" has to be
 * anchored to something concrete or the model invents its own window.
 */
function todayBlock(now = new Date()) {
  const year = now.getFullYear();
  return `# עכשיו
${todayLine(now)}
השנה הנוכחית היא ${year}. כשאתה מנסח שאלות, מחפש, או מזכיר תאריכים — התייחס ל-${year} כהווה.
"לאחרונה" / "השבוע" / "החודש" = ימים עד שבועות אחורה מהתאריך הזה, לא מנתוני האימון שלך.
אל תשאל על תחזיות לשנה שכבר הסתיימה.`;
}

module.exports = { todayLine, todayBlock };

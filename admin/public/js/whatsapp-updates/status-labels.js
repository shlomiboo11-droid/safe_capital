// A1#14 — the ONE place a session status becomes a Hebrew label.
//
// The sessions list and the chat header each kept their own table, and two of
// the seven rows disagreed ('בהמתנה' vs 'המתנה להתחלה', 'הושלם' vs 'מוכן').
// Because the list also SEARCHES on this label, typing the word you saw in the
// header returned "no matches" on a session that was right there.
//
// The header wording won — it's what's on screen most of the time.
export const STATUS_LABELS = {
  onboarding:      'המתנה להתחלה',
  researching:     'במהלך מחקר',
  research_review: 'סקירת מחקר',
  writing:         'בכתיבה',
  done:            'מוכן',
  archived:        'בארכיון'
};

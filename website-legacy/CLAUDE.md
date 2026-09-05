# Safe Capital — Landing Page Project

## Overview
דף נחיתה בעברית (RTL) לחברת סייף קפיטל — חברת השקעות נדל"ן בארה"ב (בירמינגהם, אלבמה). עסקאות Flip קצרות טווח עם תשואה עד 20%.

## Goal
דף שמשלב מסרים שיווקיים חזקים עם חוויה ויזואלית עשירה. כל מסר מילולי נתמך באלמנט ויזואלי. הגולש חייב לחוות חוויה במהלך הגלילה — לא רק לקרוא טקסט.

## Design System
שפה ויזואלית: "Architectural Ledger" — Editorial Modernism עם נגיעות חום.

**טיפוגרפיה:** גדלי פונט מוגדרים אך ורק ב-`website/css/tokens.css` (CSS variables) ו-`website/css/typography.css` (מחלקות `.t-*`). ראה את החוק ב-`CLAUDE.md` הראשי תחת "Typography — חוק ברזל".

## Agents
הפרויקט מנוהל על ידי 5 סוכנים ב-`.claude/agents/`:

| סוכן | קובץ | תפקיד |
|-------|-------|--------|
| Project Manager | `project-manager.md` | תיזמור, בקרת איכות, עקביות |
| Visual Designer | `visual-designer.md` | SVGs, אייקונים, איורים |
| Frontend Developer | `frontend-developer.md` | HTML/CSS/JS, layout, responsive |
| Scroll Experience | `scroll-experience.md` | אנימציות גלילה, counters, interactions |
| UX Reviewer | `ux-reviewer.md` | ביקורת UX, נגישות, RTL, mobile |

## Workflow
```
1. Project Manager קורא את הפרומפט ומחלק משימות
2. Visual Designer יוצר את כל ה-SVGs והאייקונים
3. Frontend Developer בונה את הדף עם הטקסט והויזואלים
4. Scroll Experience מוסיף אנימציות ו-interactions
5. UX Reviewer בודק הכל ומחזיר הערות
6. חזרה ל-3-4 לתיקונים
```

## Key Files
- `css/tokens.css` — מקור אמת לגדלי פונט (CSS variables)
- `css/typography.css` — מחלקות סמנטיות `.t-*`
- `css/shared.css` — סגנונות כלליים
- `index.html` — התוצר הסופי

## Critical Rules
1. **RTL First** — כל דבר נבנה RTL מההתחלה
2. **No Borders** — שינויי רקע בלבד בין סקשנים
3. **Visual = Message** — כל כותרת נתמכת באלמנט ויזואלי
4. **Mobile First** — 70%+ מהתנועה מטלפון
5. **Performance** — SVG inline, lazy load, no external libs
6. **Trust Over Flash** — אנימציות עדינות, לא מתלהבות. זה אתר פיננסי.

## Colors Quick Reference
פלטת "דיו ואוקסבלד". מקור האמת: `css/design-tokens.css` → `DESIGN-SYSTEM.md` §1.
```
Background:        #f7f5f1
Surface:           #ffffff
Fill:              #e8e5df
Navy (ink):        #0e1e2e
Oxblood:           #5d1819    ← מצע בהיר בלבד (11.98:1)
Oxblood on dark:   #a47e7e    ← סקשן כהה בלבד (4.71:1)
Body text:         rgba(14,30,46,0.72)
WhatsApp:          #25D366
```
`#f5f3f0`, `#1e3a5c`, `#1b1c1a` ו-`#43474e` הוסרו. הנייבי הקודם `#022445` היה כחול טהור — ראה `DESIGN-SYSTEM.md` §1.

## Fonts
```
Heebo (300, 700, 800) — משפחה אחת לכל דבר, כולל מספרים.
Inter הוסר. ראה DESIGN-SYSTEM.md §2.1
```

# Safe Capital — Landing Page Project

## Overview
דף נחיתה בעברית (RTL) לחברת סייף קפיטל — חברת השקעות נדל"ן בארה"ב (בירמינגהם, אלבמה). עסקאות Flip קצרות טווח עם תשואה עד 20%.

## Goal
דף שמשלב מסרים שיווקיים חזקים עם חוויה ויזואלית עשירה. כל מסר מילולי נתמך באלמנט ויזואלי. הגולש חייב לחוות חוויה במהלך הגלילה — לא רק לקרוא טקסט.

## Design System
שפה ויזואלית: "Architectural Ledger" — Editorial Modernism עם נגיעות חום.
ראה: `design-system.md` למפרט מלא של צבעים, טיפוגרפיה, spacing, shadows.

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
- `design-system.md` — מפרט העיצוב המלא
- `landing-page-copy.md` — כל הטקסט השיווקי
- `stitch-prompt.md` — הפרומפט המאוחד ל-Google Stitch
- `index.html` — התוצר הסופי

## Critical Rules
1. **RTL First** — כל דבר נבנה RTL מההתחלה
2. **No Borders** — שינויי רקע בלבד בין סקשנים
3. **Visual = Message** — כל כותרת נתמכת באלמנט ויזואלי
4. **Mobile First** — 70%+ מהתנועה מטלפון
5. **Performance** — SVG inline, lazy load, no external libs
6. **Trust Over Flash** — אנימציות עדינות, לא מתלהבות. זה אתר פיננסי.

## Colors Quick Reference
```
Background:  #fbf9f6
Surface:     #f5f3f0
White:       #ffffff
Navy:        #022445
Navy Dark:   #1e3a5c
Crimson:     #984349
Text:        #1b1c1a
Text Muted:  #43474e
WhatsApp:    #25D366
```

## Fonts
```
Hebrew: Heebo (300, 400, 600, 700, 800)
Numbers: Inter (400, 600, 700)
```

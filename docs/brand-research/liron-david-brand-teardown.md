# פירוק מיתוג ומערכת עיצוב — liron-david.com

מסמך רפרנס מלא, מבוסס על חקירה חיה של האתר בדפדפן: גלילה ידנית בכל העמודים, בדיקת computed styles על כל אלמנט, קריאת ה‑CSS והג'אווהסקריפט בפועל, ובדיקת כל מצבי hover / sticky / scroll.

**מטרת המסמך:** לתעד את המערכת אחד לאחד כדי שאפשר יהיה לקחת ממנה השראה מדויקת ולבנות משהו אחר לגמרי מעליה. כל המספרים כאן הם ערכי אמת מהאתר, לא הערכות.

**סטאק (לידיעה):** WordPress + OceanWP + Elementor Pro. אין framework עיצובי — כל האפקטים המעניינים הם CSS ידני + ~60 שורות JS. זה חשוב: אפשר לשחזר את כל ה‑DNA הזה בכל טכנולוגיה, אין שם קסם.

---

## 1. ה‑DNA — הרעיון שמחזיק את כל האתר

לפני צבעים ופונטים, זה מה שצריך להבין. כל האתר בנוי על **מוטיב חזותי אחד שחוזר בכל סקייל ובכל קונטקסט**: שני עיגולים נוגעים.

| איפה | איך זה מופיע |
|---|---|
| לוגו | שני עיגולים מלאים, viewBox 112×57, רדיוס 28 כל אחד, מרכזים במרחק 55.84 — כלומר **משיקים כמעט בדיוק** (חפיפה של 0.16px) |
| מעבר בין סקשנים | ה‑SVG `home.svg` — 1628×990, `rx=800` — קשת ענקית שהיא בעצם אותם שני עיגולים מתוחים לרוחב המסך |
| סקשן "HOW DO WE DO IT?" | שתי עיניים ענקיות (עיגול אפור + אישון כהה) שמסתובבות בגלילה |
| עמוד About | ה‑O ב‑"HELLOOOO" הופכים לתמונות פורטרט עגולות של הצוות |
| עמוד Services | "SOOOOO :" — אותה שרשרת עיגולים |
| Hover על כרטיס פרויקט | תג עגול עם אייקון עין (87×87, עין בהירה על רקע כהה) |
| Footer | הלוגו הפוך — שני עיגולים בהירים על כהה |
| חיווי גלילה | עיגול כהה עם סמן־יד פיקסלי |

**המסקנה למי שלוקח השראה:** לא הצבעים ולא הפונט הם המיתוג. המיתוג הוא **צורה אחת שמסרבת להשתנות ומשנה רק תפקיד וגודל**. זה הדבר היחיד שחייבים לשחזר בלוגיקה שלו — עם צורה אחרת לגמרי.

עקרונות תומכים:
1. **מונוכרום מוחלט.** אין ולו צבע מותג אחד. הצבע היחיד באתר מגיע מהעבודות של הלקוחות. זה גורם לפורטפוליו "להידלק".
2. **טיפוגרפיה כארכיטקטורה.** בעמודים הפנימיים הכותרת בגודל 20vw וגולשת מחוץ למסך משני הצדדים. הטקסט הוא הפריסה, לא תוכן בתוך הפריסה.
3. **חלל שלילי אגרסיבי.** ה‑Hero הוא 102vh עם ~605px של טקסט במרכז. יש מסכים שלמים שהם כמעט ריקים.
4. **גלילה כטריגר, לא כניווט.** כמעט כל אלמנט מעניין באתר מונע מ‑`scrollY` — לא מ‑hover ולא מקליק.
5. **טון קליל בתוך מערכת נוקשה.** "scrooooll", "HELLOOOO", "bestie boss", סמן־עכבר פיקסלי משנות ה‑90. המערכת מדויקת; הקופי לא לוקח את עצמו ברצינות.

---

## 2. צבעים

הפלטה כולה — כולל כל מצבי ה‑hover — היא **חמישה ערכים**. שאר ההקסים שנמצאו ב‑CSS הם ברירות מחדל של WordPress/Elementor שלא בשימוש.

| שם | Hex | RGB | תפקיד |
|---|---|---|---|
| Ink | `#1E1E1E` | 30,30,30 | רקע כהה ראשי, טקסט על בהיר, מילוי לוגו, מסגרות, מילוי כפתורים ב‑hover |
| Bone | `#D9D9D9` | 217,217,217 | רקע בהיר ראשי, טקסט על כהה, לוגו הפוך, קווי שדות |
| White | `#FFFFFF` | 255,255,255 | **רק** טקסט על גבי כרטיסי פרויקט (מדיה) וטקסט כפתור SUBMIT |
| Pill Grey | `#D0D0D0` | 208,208,208 | רקע ה‑header כשהוא נדבק (טון אחד כהה מ‑Bone — הפרש מינימלי בכוונה) |
| Eye Grey | `#CCCCCC` | 204,204,204 | לובן העין בסקשן הערכים |

**משתני ה‑CSS בפועל:**
```css
--e-global-color-e806229: #1E1E1E;  /* Ink */
--e-global-color-dbb58e3: #D9D9D9;  /* Bone */
```

**יחסי ניגודיות:** `#1E1E1E` על `#D9D9D9` ≈ **13.4:1** — עובר WCAG AAA בגדול. זו הסיבה שאפשר להרשות טקסט בגודל 14px בלי בעיה.

**הגרדיאנט היחיד באתר** — המעבר מבהיר לכהה:
```css
background-image: linear-gradient(0deg, #1E1E1E 64%, #4FC5710O 6%);
/* בפועל: מלמטה כהה מלא עד 64%, ומשם שקוף */
```

**היפוך לפי עמוד** — האתר עובר בין שני "מצבי תאורה" מלאים:
- Home, About, Projects → רקע Bone, טקסט Ink
- Services, Contact → רקע Ink, טקסט Bone (כולל לוגו הפוך ותפריט הפוך)

זה לא dark mode — זו החלטה עריכתית לכל עמוד.

---

## 3. טיפוגרפיה

**משפחה אחת: Montserrat.** בלי יוצא מן הכלל, בכל האתר.
משקלים שנטענים בפועל: **400, 500, 600, 700**. (100–300 ו‑800–900 מוצהרים אבל `unloaded` — לא בשימוש.)

### 3.1 החלטה מבנית: כל הטיפוגרפיה ב‑vw

זה הדבר הכי חשוב בפרק הזה. **אין באתר כמעט אף `font-size` בפיקסלים בדסקטופ.** הכול יחסי לרוחב הדפדפן. התוצאה: הטיפוגרפיה מתנהגת כמו פוסטר — היחסים בין הגדלים נשמרים תמיד, בכל מסך.

המחיר: זה נשבר בקצוות (1vw = 3.2px במסך 320px), ולכן באתר יש override לפיקסלים בברייקפוינטים של טאבלט ומובייל.

### 3.2 סולם הטיפוגרפיה המלא

px מחושב על viewport של 1440px.

| תפקיד | Desktop | ≈px@1440 | Tablet (≤1024) | Mobile (≤767) | Weight | Line-height | Transform |
|---|---|---|---|---|---|---|---|
| Display ענק (HELLOOOO / SOOOOO) | 20vw | 288 | — | — | 700 | 0.72em | uppercase |
| גליף נקודתיים ":" | 26.2vw | 377 | — | — | 700 | 0.72em | — |
| H1 Hero | 3.3vw | 47.5 | 6.2vw | 7.8vw | 700 | 1.2em | none |
| כותרת עמוד (LET'S TALK.) | 5.6vw | 80.6 | — | — | 700 | 1em | uppercase |
| H2 סקשן (HOW DO WE DO IT?) | 4.9vw | 70.6 | 7.1vw | — | 700 | 1em | none |
| Eyebrow (OUR MISSION IS CLEAR:) | 1.5vw | 21.6 | 3.2vw | 3.8vw | 400 | 1em | **uppercase** |
| משפט מרכזי (To elevate…) | 3.3vw | 47.5 | 6.2vw | 7.8vw | 700 | 1.3em | none |
| כותרת ערך (We're avid listeners) | 2vw | 28.8 | 30px | 22px | 600 | 1.4em | none |
| ספרור ערך (A. B. C.) | 2.2vw | 31.7 | 32px | 22px | 700 | — | upper-alpha |
| כותרת כרטיס פרויקט | 2.5vw | 36 | 30px | 18px | 600 | 1.4em | none |
| קטגוריית כרטיס | 1.2vw | 17.3 | 14px | — | 400 | 1.8em | lowercase |
| Body / תיאור ערך | 1vw | 14.4 | 18px | 16px | 400 | 1.8em | none |
| קישור ניווט (desktop) | 1.1vw | 15.8 | — | — | 600 | — | none |
| קישור ניווט (overlay מובייל) | — | — | — | **11vw** | 600 | — | **uppercase** |
| כפתור ראשי (SEE ALL) | 1.5vw | 21.6 | — | — | 500 | 1em | uppercase |
| כפתור טופס (SUBMIT) | 2vw | 28.8 | — | — | 500 | — | uppercase |
| פילטר (All / Brand) | 1.2vw | 17.3 | — | — | 700 | — | none |
| שדה טופס | 1vw | 14.4 | — | — | 400 | 1.8em | none |
| קישור פוטר | 1vw | 14.4 | — | — | 400 | 1.8em | none |
| שורת זכויות | 0.9vw | 13 | — | — | 400 | 1.8em | none |
| תווית גלילה ("scrooooll") | 18px | 18 | — | — | 600 | 1.4em | lowercase |

### 3.3 ריווח אותיות (letter-spacing)

זה כמעט תמיד `normal`. שתי חריגות בלבד, ושתיהן מכוונות:

| איפה | ערך | למה |
|---|---|---|
| ה‑"ooo" ב‑HELLOOOO | **−0.081em** (−27.09px על 334.4px) | לוחץ את העיגולים אחד לשני עד שהם נראים כמו שרשרת עיניים — בדיוק כמו הלוגו |
| SUBMIT | **+0.1em** | פותח את הכפתור, נותן לו נוכחות של "פעולה סופית" |

### 3.4 גובה שורה — הסולם

| ערך | איפה |
|---|---|
| **0.72em** | Display ענק — שורות נדחסות זו לזו, גוש טיפוגרפי אחד |
| **1em** | Eyebrow, כותרות עמוד, כפתורים |
| **1.2em** | H1 |
| **1.3em** | משפט מרכזי (קצת יותר אוויר כי הוא נקרא לאט) |
| **1.4em** | כותרות ערך, כותרות כרטיס |
| **1.8em** | **כל טקסט הרץ** — נדיב מאוד, זה מה שנותן את התחושה האוורירית |

### 3.5 היררכיה בפועל

הקפיצה בין רמות היא **פי 2 עד פי 3.3**, לא פי 1.25 כמו בסולם טיפוגרפי רגיל:

```
1vw  (body)
1.5vw (eyebrow / button)     ×1.5
3.3vw (H1)                   ×2.2
4.9vw (H2 סקשן)              ×1.5
20vw  (display)              ×4.1
```

זה לא סולם מוזיקלי — זו קפיצה דרמטית מכוונת. או שהטקסט קטן וצנוע, או שהוא ענק וגולש מהמסך. **אין אמצע.**

---

## 4. פריסה, גריד ומרווחים

### 4.1 רוחבי קונטיינר (וריאבילי — לא קבועים)

| סקשן | Desktop | Tablet |
|---|---|---|
| Hero | 53vw | 85vw |
| בלוק ה‑H1 בתוך ה‑Hero | 52vw max-width, padding 5vw | 93vw |
| סקשן המשפט המרכזי | 70vw | — |
| רשת הפרויקטים | 90vw | — |
| Header במצב נדבק | **60vw** | 92vw |
| טופס יצירת קשר | ~48.8vw | — |

**זה לא container אחד לכל האתר.** כל סקשן מקבל רוחב אחר, וזה מה שיוצר את הקצב.

### 4.2 גבהי סקשנים

| סקשן | גובה |
|---|---|
| Hero | `min-height: 102vh` (מכוון — מבטיח שהמשתמש רואה שיש עוד) |
| סקשן המעבר (הקשת) | `min-height: 70vw` (טאבלט 90vw, מובייל 190vw) |
| הסקשן הכהה ("HOW DO WE DO IT") | `min-height: 150vw` — **מסלול גלילה, לא סקשן תוכן** |
| Padding אנכי בסקשן הכהה | 14% למעלה, 10% מהצדדים |

### 4.3 רשת הפרויקטים

```css
.loop-container { display: flex; flex-wrap: wrap; gap: 3.2%; }
.loop-item      { width: 48.4%; margin-bottom: 3.2%; }
.loop-item:nth-child(5n+2) { width: 100%; }   /* ← כל פריט 2, 7, 12 הוא רוחב מלא */
```

גבהי מדיה:
| מצב | גובה |
|---|---|
| כרטיס רגיל, desktop | 23vw |
| כרטיס "featured" (5n+2), desktop | 40vw |
| tablet | 51vw |
| mobile | 50vw ברוחב 100vw (bleed מלא) |

**הרעיון:** רשת 2 טורים שנשברת בקצב קבוע לרוחב מלא. זה מונע מהפורטפוליו להיראות כמו טבלה, ומייצר "נשימה" עריכתית.

### 4.4 סולם מרווחים

האתר לא משתמש בסולם 4/8px. הוא משתמש ביחידות vw:

```
1vw · 2vw · 3vw · 4vw · 5vw
```
בתוספת padding באחוזים לסקשנים גדולים: `14%`, `10%`, `5%`, `3.2%`.

מרווחים ספציפיים ששווה לאמץ:
- padding פנימי של כרטיס פרויקט: **2vw**
- מרווח בין פריטי ניווט: **3vw**
- מרחק תג ה‑hover מפינת הכרטיס: **1.7vw**
- מרווח אנכי בין ערכים ברשימה: **4vw**

---

## 5. Header וניווט

### 5.1 שני מצבים, מעבר של 0.3s

**מצב מנוחה (scrollY < 20):**
- רוחב מלא, רקע **שקוף לחלוטין**
- לוגו: SVG של שני עיגולים, גובה **6vw** (מובייל 10vw)
- ניווט מיושר לימין, 4 פריטים

**מצב נדבק (scrollY ≥ 20):**
```css
.top-header.elementor-sticky--effects .e-con-inner { max-width: 60vw; }
.top-header.elementor-sticky--effects .inner-header { background: #D0D0D0; }
.top-header .e-con-inner, .top-header .inner-header {
  transition-duration: .3s;
  transition-property: all;
}
```
- ה‑header **מתכווץ** מ‑100vw ל‑60vw
- מקבל רקע `#D0D0D0` ו‑`border-radius: 100px` — הופך לגלולה צפה
- padding: `0.8vw 2vw 0.8vw 1vw` (א‑סימטרי — יותר אוויר מימין)
- `justify-content: space-between`, `align-items: center`

זה האפקט הכי "יקר" באתר ביחס למאמץ. שתי שורות CSS.

### 5.2 מצב הקישור — קו חוצה, לא קו תחתון

```css
#menu ul a:after {
  content: ''; height: 2px; width: 100%;
  background: #1E1E1E;
  position: absolute; top: 50%; right: 50%;
  transform: translate(50%,50%) scale(0);
  transition: .2s all;
}
#menu ul a:hover:after,
#menu ul a.current-link:after { transform: translate(50%,50%) scale(1); }
```
- הקו עובר **דרך אמצע הטקסט** (top 50%), לא מתחתיו — נראה כמו strikethrough
- נפתח מהמרכז החוצה (`scale(0) → scale(1)`) ב‑0.2s
- **אותו אפקט מסמן גם hover וגם את העמוד הנוכחי** — חיסכון קוגניטיבי אלגנטי
- במובייל הקו עבה יותר: 3px, ב‑`top: 45%`

### 5.3 עמעום קבוצתי (הפרט הכי מתוחכם בניווט)

```css
#menu:hover a:not(:hover) { opacity: .4; }
#menu ul:hover a          { opacity: .5; }
#menu ul a                { transition: opacity .3s ease-in-out; }
#menu ul a:hover          { opacity: 1; }
```

כשהעכבר נכנס לאזור הניווט — **כל הקישורים דוהים ל‑0.4**, וזה שמעליו העכבר חוזר ל‑1. פוקוס אקטיבי, לא רק הדגשה.

### 5.4 תפריט מובייל

```css
#menu {
  position: fixed; inset: 0; width: 100%; height: 100%;
  background: #D9D9D9;
  opacity: 0; visibility: hidden;
  transition: all .3s ease-in-out;
  z-index: 10;
}
#menu.open { opacity: 1; visibility: visible; }
#menu .main-nav { position: relative; top: 50%; transform: translateY(-50%); }
#menu .main-nav a { font-size: 11vw; font-weight: 600; text-transform: uppercase; }
```

כניסת הפריטים — **stagger ידני**:
```css
#menu.open li {
  animation-name: fadeInUp;
  animation-duration: 1s;
  animation-fill-mode: both;
}
#menu.open li:first-child   { animation-delay: .1s; }
#menu.open li:nth-child(2)  { animation-delay: .2s; }
#menu.open li:nth-child(3)  { animation-delay: .3s; }
#menu.open li:nth-child(4)  { animation-delay: .4s; }
#menu.open li:nth-child(5)  { animation-delay: .5s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translate3d(0,100%,0); }
  to   { opacity: 1; transform: none; }
}
```

ה‑toggle עצמו הוא `<button class="toggle-menu"><span id="button-wrapper"></span></button>`, ו‑jQuery פשוט עושה `toggleClass('open')`.

---

## 6. כפתורים ואלמנטים אינטראקטיביים

### 6.1 כפתור ראשי — Ghost Pill (SEE ALL)

```css
background-color: transparent;
color: #1E1E1E;
fill: #1E1E1E;
border: 1px solid #1E1E1E;
border-radius: 100px;
font: 500 1.5vw/1em Montserrat;
text-transform: uppercase;
padding: .5em 3em .5em 1.1em;   /* ← א‑סימטרי: 3em מימין לאייקון החץ */
transition: .3s;
```
**Hover:**
```css
background-color: #1E1E1E;
color: #D9D9D9;
border-color: #D9D9D9;
svg { fill: #D9D9D9; }
```
היפוך מלא — לא שינוי גוון. אייקון: חץ ימינה, קווי, ללא מסגרת.

### 6.2 כפתור טופס — Dark Pill (SUBMIT)

```css
background: #1E1E1E;
color: #FFFFFF;
border: 1px solid #D9D9D9;
border-radius: 100px;
font: 500 2vw Montserrat;
letter-spacing: .1em;
text-transform: uppercase;
padding: .6vw 5vw .6vw 1.2vw;   /* 5vw מימין — מקום לחץ */
transition: .3s;
```

### 6.3 תג עין — Hover על כרטיס פרויקט

```css
.e-loop-item a:after {
  content: '';
  position: absolute; bottom: 1.7vw; right: 1.7vw;
  width: 4vw; height: 4vw;
  background: url(eye-badge.svg) center/contain no-repeat;
  opacity: 0; transform: scale(0);
  transition-duration: .5s;
  z-index: 2;
}
.e-loop-item a:hover:after { opacity: 1; transform: scale(1); }
```
ה‑SVG: עיגול 87×87 במילוי `#1E1E1E`, בתוכו צורת עין ב‑`#D9D9D9` ואישון ב‑`#1E1E1E`.

**וריאציה:** כל פריט `5n+2` (הכרטיס ברוחב מלא) מקבל במקום זה **גלולה רחבה** 11.6vw × 3vw — SVG 243×61, `rx=30.5`, רקע `#1E1E1E`, טקסט לבן. יחס 4:1.

### 6.4 חשיפת טקסט על כרטיס — Hover

```css
.elementor-cta__content { padding: 2vw; align-items: flex-end; transition: .5s; }
.elementor-cta__title, .elementor-cta__description { opacity: 0; transition-duration: .2s; }
/* stagger: */
.elementor-cta__content-item:nth-child(2) { transition-delay: calc(200ms / 3); }      /* 66.7ms */
.elementor-cta__content-item:nth-child(3) { transition-delay: calc(200ms / 3 * 2); }  /* 133ms */
```
במנוחה הכרטיס הוא **רק מדיה**. ב‑hover הקטגוריה והכותרת נכנסות ב‑fade עם stagger של 66.7ms, מיושרות לתחתית‑שמאל, בזמן שתג העין נכנס מימין.

> ⚠️ **חולשה שכדאי לתקן אצלך:** אין שכבת overlay כהה בכלל. הטקסט הלבן יושב ישירות על הווידאו/תמונה. באתר הזה זה עובד כי הם שולטים בחומרי הגלם — אבל זה שביר. **הוסף גרדיאנט תחתון** (`linear-gradient(0deg, rgba(0,0,0,.65), transparent 60%)`) שנכנס יחד עם הטקסט.

### 6.5 פילטרים (עמוד פרויקטים)

```css
.filter-list { display: flex; justify-content: space-between; width: 90vw; }
.filter-item label { font: 700 1.2vw Montserrat; color: #1E1E1E; cursor: pointer; }
.filter-item label            { opacity: .3; }
.filter-item input:checked ~ label { opacity: 1; }
```
מבנה radio נסתר + label. **המצב הפעיל מסומן באטימות בלבד** (0.3 → 1), אותו משקל ואותו צבע. פרוס `space-between` על כל רוחב הרשת — כמו טאבים בעיתון.

---

## 7. אנימציות ותנועה — האינוונטר המלא

זה הלב של האתר. **13 אפקטים, אף אחד מהם לא ספרייה חיצונית** (חוץ מ‑Lottie ל‑loader).

### 7.1 Loader
```js
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => document.querySelector('#loader').classList.add('hide-loader'), 1300);
});
```
אנימציית Lottie ברוחב 12vw במרכז. נעלמת אחרי **1300ms קבועים** (לא מחכה לטעינה בפועל), עם `fadeIn` של 1.25s על התוכן.

### 7.2 סמן מהבהב "_"
```html
<h1>…the brand experience<span class="flickering">_</span></h1>
```
```css
.flickering { animation: 1s infinite fadeInOut; }
@keyframes fadeInOut { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
```
סמן טרמינל. הופך את המשפט למשהו שעדיין נכתב. **פרט קטן, נוכחות ענקית.**

### 7.3 חיווי גלילה
```css
.scroll-icon { position: fixed !important; bottom: 20px; left: 50%; transform: translateX(-50%); }
.scroll-icon:before {
  content: ''; position: absolute; z-index: -1;
  width: 3vw; height: 3vw;          /* tablet 6vw, mobile 12vw */
  top: -1vw; left: 50%; transform: translateX(-50%);
  background: #1E1E1E; border-radius: 100px;
}
.scroll-icon img { animation: 2s ease-in-out infinite moveUpDown; }
@keyframes moveUpDown { 0%,100% { transform: translateY(0) } 50% { transform: translateY(10px) } }
```
תמונה: SVG של **סמן‑יד פיקסלי בסגנון Windows 95**, ברוחב 30px, על עיגול כהה. מתחתיו התווית `scrooooll`. `position: fixed` — נשאר לאורך כל הגלילה, לא רק ב‑Hero.

### 7.4 מורפינג ה‑Header
מתואר בסעיף 5.1. `transition: all .3s` על `max-width` ועל `background`.

### 7.5 חשיפת הקשת — המעבר בין בהיר לכהה
```css
.elevate-section {
  background-image: url(home.svg);        /* 1628×990, rx=800, fill #1E1E1E */
  background-position: top center;
  background-size: 120vw auto;
  min-height: 70vw;
}
.elevate-section::before {
  content: '';
  background-image: linear-gradient(0deg, #1E1E1E 64%, transparent 6%);
}
```
צורת קפסולה ענקית עולה מלמטה על רקע ה‑Bone, וגרדיאנט כהה "בולע" אותה מהתחתית. התוצאה: הרקע הכהה **נולד** מהבהיר, לא מוחלף בו. **זה האפקט הכי חזק באתר.**

### 7.6 משפט "נעוץ" (Pinned statement)
האלמנט הוא `position: fixed`, וה‑opacity שלו מחושבת ידנית מ‑`scrollY`:

```js
const params = {
  desktop: { start: '40vw', centerStart: '58vw', centerEnd: '67vw', end: '92vw' },
  tablet:  { start: 650,    centerStart: 825,    centerEnd: 925,    end: 1100 },
  mobile:  { start: 500,    centerStart: 650,    centerEnd: 750,    end: 900  }
};
// scrollPos < start                → opacity 0
// start … centerStart              → fade in ליניארי
// centerStart … centerEnd          → opacity 1 (החזקה)
// centerEnd … end                  → fade out ליניארי
// > end                            → opacity 0
```
ארבע נקודות עוגן, לא שתיים: **fade-in → hold → fade-out**. ה‑hold הוא מה שגורם למשפט להרגיש "נעצר" בלי scroll-jacking אמיתי. הברייקפוינטים של ה‑JS: מובייל ≤600, טאבלט 601–1300, דסקטופ >1300.

### 7.7 מסלול גלילה אופקי
```js
const progress = clamp01((scrollY - section.offsetTop) / ((section.offsetHeight - innerHeight) * 0.6));
greenItems.forEach(el => el.style.transform = `translateX(${-50 * progress}vw)`);
```
שלושה פאנלים של 50vw כל אחד בשורה אחת. הסקשן העוטף הוא `min-height: 150vw`. גלילה אנכית → תנועה אופקית של פאנל אחד בדיוק.
ה‑`* 0.6` במכנה אומר: **הסיבוב מסתיים ב‑60% מהמסלול** ואז יש "מנוחה" — אפשר לקרוא בלי לחץ.

### 7.8 סיבוב העיניים
```css
.eye {
  position: relative; display: inline-block;
  width: 10vw; height: 10vw;             /* tablet 25vw, mobile 35vw */
  border-radius: 50%;
  background: #CCCCCC;
  transition: transform .3s ease-out;
}
.eye:after {
  content: " ";
  position: absolute; top: 50%; left: 0;
  width: 3vw; height: 3vw;               /* tablet 7.5vw, mobile 10.5vw */
  background: #1E1E1E; border-radius: 50%;
  transform: translateY(-50%);
}
```
```js
const progressEye = clamp01((scrollY - section.offsetTop) / ((section.offsetHeight - innerHeight) * 0.9));
eyes.forEach(eye => eye.style.transform = `rotate(${200 * progressEye}deg)`);
```
האישון ממוקם ב‑`left: 0` (הקצה), אז סיבוב של הריבוע כולו מסובב את האישון סביב מרכז העין. **0° → 200°** — קצת יותר מחצי סיבוב, כך שהעיניים "מסתכלות סביב" ולא חוזרות למקום.
ה‑`transition: .3s ease-out` על ה‑transform מוסיף inertia — העין מגיעה קצת אחרי הגלילה. **הפרט הזה הוא כל ההבדל בין "מסתובב" ל"חי".**

מכנה שונה מזה של הפאנלים (0.9 מול 0.6) → העיניים והפאנלים לא מסונכרנים. יותר אורגני.

### 7.9 Fade של בלוק הערכים
Elementor Motion Effects — transparency, `transition-duration: 100ms`, `will-change: opacity`.

### 7.10 Hover על כרטיס
סעיף 6.4.

### 7.11 תפריט Overlay
סעיף 5.4.

### 7.12 גלילה חלקה גלובלית
```css
html { scroll-behavior: smooth; }
```

### 7.13 מגן ביצועים
```js
if (window.innerWidth >= 1200) { /* כל אפקטי הגלילה */ }
```
**כל אפקטי ה‑transform מנוטרלים מתחת ל‑1200px.** במובייל האתר הוא פשוט אתר גלילה רגיל. החלטה נכונה.

### סיכום עקומות התזמון

| משך | איפה |
|---|---|
| **0.2s** | קו הניווט, טקסט על כרטיס |
| **0.3s** | header, hover של כפתורים, שדות, אינרציית העיניים, תפריט overlay |
| **0.5s** | תג העין, קונטיינר הכרטיס |
| **1s** | הבהוב הסמן, כניסת פריטי תפריט |
| **1.25s** | fadeIn של התוכן |
| **1.5s / 1.7s** | מעברי רקע איטיים על כרטיסים |
| **2s** | ריחוף חיווי הגלילה |
| **1300ms** | ה‑loader |

Easing: `ease-in-out` לאנימציות מחזוריות, `ease-out` לאינרציה, ברירת מחדל לשאר. **אין spring, אין bounce, אין cubic-bezier מותאם.** התנועה נקייה ומאופקת בכוונה.

---

## 8. מבנה שדות וטפסים

עמוד ה‑Contact הוא כל מערכת הטפסים באתר.

### 8.1 מבנה

```
כותרת "LET'S TALK."  ← 5.6vw / 700 / uppercase / lh 1em
    ↓ ~100px
┌─────────────────┬─────────────────┐
│ First Name*     │ Last Name*      │
├─────────────────┼─────────────────┤
│ Email*          │ Phone*          │
├─────────────────┼─────────────────┤
│ Company*        │ Website*        │
└─────────────────┴─────────────────┘
    ↓ 100px
☐  טקסט הסכמה + קישור מדיניות פרטיות
    ↓ 65px
        [ SUBMIT → ]   ← ממורכז
```

### 8.2 מפרט מדויק

| מאפיין | ערך |
|---|---|
| רוחב הטופס | 815.8px @1672vw ≈ **48.8vw**, ממורכז |
| פריסה | 2 טורים, כל field-group = **50%** |
| padding של field-group | `0 15px` (יוצר מרווח 30px בין הטורים) |
| **גובה שדה** | **40px** |
| **מרווח אנכי בין שורות** | **50px** (pitch של 90px) |
| מרווח לפני ה‑checkbox | 100px |
| מרווח לפני ה‑submit | 65px |

### 8.3 עיצוב השדה — קו תחתון בלבד

```css
.field {
  background: transparent;
  border: none;
  border-bottom: 1px solid #D9D9D9;
  border-radius: 0;
  padding: 0;
  height: 40px;
  font: 400 1vw/1.8em Montserrat;
  color: #D9D9D9;
  transition: .3s;
}
```
**אין קופסה. אין רקע. אין radius.** רק קו של 1px. הטופס נראה כמו טופס נייר, לא כמו UI.

### 8.4 תוויות — מודל ה‑placeholder

- הטקסט הנראה (`First Name*`) הוא **placeholder**, לא label
- ה‑`<label>` האמיתי קיים ב‑DOM אבל מוסתר ויזואלית (`height: 1px; margin-bottom: -1px`, מחוץ למסך) — נגיש לקוראי מסך בלבד
- סימון חובה: **כוכבית בתוך ה‑placeholder עצמו**, לא אלמנט נפרד
- שדות עם `required=true` בפועל: First Name, Last Name, Email, Phone. Company ו‑Website מסומנים ב‑`*` אבל **אינם חובה** — חוסר עקביות

> ⚠️ **זה הפגם הכי גדול באתר.** ברגע שהמשתמש מתחיל להקליד — התווית נעלמת. בטופס של 6 שדות אחרי מילוי חלקי אי אפשר לדעת מה כל שדה. **אל תשחזר את זה.** השתמש ב‑floating label: אותה אסתטיקה של קו תחתון, אבל התווית עולה ומתכווצת (0.75em, opacity 0.6) במקום להיעלם.

### 8.5 Checkbox

```css
input[type=checkbox] {
  appearance: none;
  width: 16px; height: 16px;
  background: transparent;
  border: 1px solid #D9D9D9;
  border-radius: 0;          /* ריבוע — הצורה היחידה באתר שאיננה עיגול */
}
```
טקסט ההסכמה: 16px, `#D9D9D9`, עם קישור inline מודגש בקו תחתון.

### 8.6 מה חסר בטופס (ורצוי שיהיה אצלך)

- אין **focus ring** נראה — רק המעבר של 0.3s. בעיית נגישות.
- אין מצב **error** מעוצב
- אין מצב **loading / disabled** לכפתור השליחה
- אין **success state** מעוצב
- אין `textarea` — אין שדה "ספר לנו על הפרויקט"

---

## 9. פירוק העמודים

### Home
1. **Hero** — 102vh, Bone, H1 ממורכז 3.3vw ברוחב 52vw, סמן מהבהב, חיווי גלילה קבוע
2. **מעבר** — קשת SVG ענקית + גרדיאנט, משפט נעוץ ב‑fade
3. **הסקשן הכהה** — 150vw, מסלול גלילה אופקי: כותרת → עיניים → רשימת ערכים A/B/C
4. **פורטפוליו** — Bone, רשת 90vw, 2 טורים עם שבירה כל 5n+2
5. **CTA** — כפתור SEE ALL ממורכז
6. **Footer** — Ink, לוגו הפוך + wordmark, 3 קישורים, שורת זכויות

### About
כותרת `HELLOOOO!` ב‑20vw כמסלול אופקי; ה‑O הופכים לפורטרטים עגולים של הצוות (שחור־לבן); כל פורטרט עם שם (bold) ותפקיד (regular) מתחתיו; סימן הקריאה מוביל לפסקת גוף.

### Services
אותו מנגנון על רקע Ink: `SOOOOO :` ב‑20vw, ה‑O כטבעות מתאר; אחריו סקשן שירותים ואז חזרה ל‑Bone עם רשימת קטגוריות (BRANDING / DIGITAL PRODUCTS / WEBSITES / CONTENT / & MORE).

### Projects
שורת פילטרים ברוחב 90vw ב‑`space-between`, ואז אותה רשת של דף הבית.

### Contact
Ink מלא, `LET'S TALK.` ב‑5.6vw, טופס בשני טורים.

---

## 10. Footer

```
        ●●              ← לוגו הפוך, שני עיגולים #D9D9D9
     liron david        ← wordmark, lowercase, letter-spaced
                        
  Privacy | Accessibility | Terms      ← 1vw / 400 / #D9D9D9, מופרדים בקו אנכי
                                       
  All rights reserved Ⓒ lirondavid 2025 | Developed by Digita   ← 0.9vw
```
רקע `#1E1E1E`, הכול ממורכז, גובה ~407px. **אין שם ניווט, אין ניוזלטר, אין רשתות חברתיות.** מינימלי בכוונה.

---

## 11. ברייקפוינטים

| מקור | ערכים |
|---|---|
| Elementor (CSS) | mobile ≤767 · tablet 768–1024 · desktop ≥1025 |
| ה‑JS של האתר | mobile ≤600 · tablet 601–1300 · desktop >1300 |
| מגן אפקטי הגלילה | פעיל רק ב‑`innerWidth >= 1200` |

**שים לב:** שלוש מערכות ברייקפוינטים שונות באותו אתר. אצלך — הגדר אחת.

---

## 12. חולשות שזיהיתי — אל תשחזר אותן

1. **תוויות placeholder בלבד** (סעיף 8.4) — הבעיה הכי חמורה.
2. **אין `prefers-reduced-motion`.** אף אחת מהאנימציות המותאמות לא מכבדת את ההעדפה. זו דרישת נגישות.
3. **אין focus ring נראה** באף אלמנט אינטראקטיבי.
4. **טיפוגרפיה ב‑vw בלי clamp.** במסך של 1920px ה‑body הופך ל‑19px ובמסך 1280px ל‑12.8px. הפתרון הנכון: `clamp(14px, 1vw, 20px)`.
5. **טקסט לבן על מדיה שרירותית** בכרטיסי הפרויקט, בלי שכבת overlay.
6. **באג פעיל:** ה‑scroll listener קורא ל‑`adjustOpacity(howWeDoItParams)` כשהמשתנה הזה לא מוגדר בעמוד הבית — נזרקת `ReferenceError` בכל אירוע גלילה.
7. **מאזיני scroll בלי throttle / rAF.** שני listeners נפרדים שמריצים `getBoundingClientRect` בכל פריים.
8. **Loader בטיימר קבוע** (1300ms) שלא קשור לטעינה בפועל — משתמש בחיבור מהיר ממתין לחינם.
9. **סימון פילטר באטימות בלבד** — 0.3 מול 1.0 באותו צבע; קשה לזיהוי.
10. **חוסר עקביות בשדות חובה** (Company/Website עם `*` אבל לא required).

---

## 13. איך לוקחים את זה — ומה משנים לסייף קפיטל

**מה שהופך את האתר הזה לטוב הוא לא הביצוע — הוא ההחלטות.** אלה ההחלטות ששוות העברה, וזה מה שצריך להשתנות:

| מה לקחת (הלוגיקה) | מה לזרוק (הביטוי) |
|---|---|
| מוטיב גיאומטרי אחד שחוזר בכל סקייל ובכל תפקיד | **העיגולים והעיניים** — הם החתימה של liron&david |
| בסיס מונוכרומטי כדי שהתוכן יביא את הצבע | הגוונים הספציפיים `#1E1E1E` / `#D9D9D9` |
| משפחת פונט אחת, 3–4 משקלים בלבד | **Montserrat** — היא זהות מוכרת |
| טיפוגרפיה יחסית לרוחב המסך (עם clamp) | הערכים 20vw / 3.3vw |
| גלילה כמנוע התנועה הראשי, לא hover | ה‑200° / ה‑50vw הספציפיים |
| מעבר צורני בין מצבי תאורה (הקשת) | הקפסולה עצמה — בחר צורה שנגזרת מהמוטיב שלך |
| Header שמתכווץ לגלולה בגלילה | radius 100px + `#D0D0D0` |
| קו חוצה כסימון hover ו‑current כאחד | — |
| עמעום קבוצתי בניווט (`:hover a:not(:hover)`) | — |
| רשת שנשברת בקצב קבוע (5n+2) | — |
| שדות עם קו תחתון בלבד | מודל ה‑placeholder — **החלף ב‑floating label** |
| ארבע נקודות עוגן ל‑fade (in → hold → out) | — |
| אינרציה של 0.3s על אלמנטים מונעי‑גלילה | — |

### התאמות חובה לסקטור הפיננסי

האתר המקורי הוא סטודיו עיצוב — הוא מרוויח מלהיות שובב ("scrooooll", "bestie boss", סמן פיקסלי). **סייף קפיטל לא.** קליינט פיננסי סורק אתר ומחפש ראיות לאמינות, לא לאישיות. מה שצריך להשתנות ברמת המערכת:

1. **טון הקופי** — הקלילות הזו לא עוברת. אותה מינימליות, אפס עליצות.
2. **חלל שלילי ≠ חוסר מידע.** ה‑Hero כאן הוא 102vh עם משפט אחד. באתר פיננסי אפשר לשמור על הנשימה, אבל צריך לתת עוגן קונקרטי (מספר, קטגוריה, הוכחה) **מעל הקיפול**.
3. **פורטפוליו → הוכחות.** הרשת הוויזואלית של liron&david עובדת כי העבודות יפות. בפיננסים המקבילה היא נתונים, לוגואים של שותפים, מספרים — אותה רשת עריכתית, תוכן אחר לגמרי.
4. **הצע אמון היכן שאין תמונות.** האתר המקורי נשען לגמרי על מדיה כדי לשבור את המונוכרום. אם לסייף קפיטל אין ספרייה ויזואלית חזקה — צריך מקור צבע/עניין חלופי (דאטה־ויז, טיפוגרפיה, גיאומטריה) אחרת המונוכרום יקרוס לריק.
5. **הוסף את מה שחסר שם:** מצבי error/success, focus rings, `prefers-reduced-motion`, שדה טקסט חופשי בטופס. באתר פיננסי אלה לא nice-to-have.

---

## נספח: טוקנים מוכנים להעתקה

```css
:root {
  /* ── Color ─────────────────────────── */
  --ink:        #1E1E1E;
  --bone:       #D9D9D9;
  --white:      #FFFFFF;
  --pill:       #D0D0D0;
  --eye:        #CCCCCC;

  /* ── Type ──────────────────────────── */
  --font: 'Montserrat', sans-serif;
  --fw-regular: 400;
  --fw-medium:  500;
  --fw-semi:    600;
  --fw-bold:    700;

  --fs-display: 20vw;
  --fs-page:    5.6vw;
  --fs-h1:      3.3vw;
  --fs-h2:      4.9vw;
  --fs-card:    2.5vw;
  --fs-value:   2vw;
  --fs-lead:    1.5vw;
  --fs-meta:    1.2vw;
  --fs-nav:     1.1vw;
  --fs-body:    1vw;
  --fs-legal:   0.9vw;

  --lh-display: 0.72em;
  --lh-tight:   1em;
  --lh-h1:      1.2em;
  --lh-lead:    1.3em;
  --lh-title:   1.4em;
  --lh-body:    1.8em;

  --ls-tight:  -0.081em;
  --ls-wide:    0.1em;

  /* ── Space ─────────────────────────── */
  --s-1: 1vw;  --s-2: 2vw;  --s-3: 3vw;  --s-4: 4vw;  --s-5: 5vw;

  /* ── Container ─────────────────────── */
  --w-hero:    53vw;
  --w-section: 70vw;
  --w-grid:    90vw;
  --w-sticky:  60vw;
  --w-form:    48.8vw;

  /* ── Radius ────────────────────────── */
  --r-pill:   100px;
  --r-circle: 50%;
  --r-square: 0;

  /* ── Motion ────────────────────────── */
  --t-fast:   .2s;
  --t-base:   .3s;
  --t-slow:   .5s;
  --t-slower: 1.5s;
  --ease:     ease-in-out;
  --ease-out: ease-out;
}

/* גרסה מתוקנת של הטיפוגרפיה — עם clamp במקום vw חשוף */
:root {
  --fs-body: clamp(15px, 1vw, 20px);
  --fs-h1:   clamp(32px, 3.3vw, 64px);
  --fs-display: clamp(64px, 20vw, 380px);
}

/* כיבוד העדפת תנועה מופחתת — חסר במקור */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---
id: 030
captured_at: 2026-05-07T15:26:56Z
has_image: true
images:
  - sequence/030-image-1.txt
suggested_agents:
  - visual-designer
complexity: medium
---

# פרומפט מקורי
/figma-designer
בעמודי התווך של הכלכלה אני רוצה תמונה לכל אחד מהטקסטים

# משימה משופרת
**העמוד:** `website/birmingham.html` — סקציית "עמודי התווך של הכלכלה" (Economic Pillars).

**המצב היום:** לכל אחת מ-3 כרטיסיות העמודים יש placeholder עם רקע בז' (`bg-surface-container-low`) ובתוכו רק אייקון Material Symbol גדול (`local_hospital` / `account_balance` / `biotech`) + תווית קטנה. זה לא תמונה — זה אייקון על רקע ריק.

**הבקשה:** להחליף את ה-placeholder בתמונה אמיתית פוטוריאליסטית לכל אחד מ-3 העמודים.

**שלושת העמודים והקשרם:**
1. **רפואה ומחקר — UAB Medicine** (שורות ~292-307): המעסיק הגדול במדינה, 28,000 עובדים, מוסד רפואי מוביל. תמונה מתאימה: בית חולים מודרני / מתחם רפואי / רופאים בפעולה / חוקרים במעבדה רפואית.
2. **פיננסים ובנקאות — Regions Financial** (שורות ~309-325): רשימת פורצ'ון 500, 19,600 עובדים, מטה ראשי בבירמינגהם. תמונה מתאימה: מגדל משרדים בירמינגהם / סקייליין דאונטאון בירמינגהם / לובי משרדים פיננסיים מודרני.
3. **טכנולוגיה וחדשנות — Innovation Depot** (שורות ~327-343): אינקובטור טכנולוגי 140K רגל רבוע, ביוטכנולוגיה, FDA. תמונה מתאימה: מעבדת ביוטק מודרנית / חוקרים עם ציוד טכנולוגי / חלל קו-וורקינג מודרני.

**כללי הפרויקט (מתוך CLAUDE.md הראשי):**
- כל תמונה תיווצר עם `nano-banana` (generate_image) — פוטוריאליסטית, באנגלית, מפורטת.
- שמירה ל-`website/images/birmingham/` (תיקייה חדשה אם חסרה).
- יחס גובה-רוחב: ~`4:3` (התמונה תופסת חצי כרטיסייה משמאל בדסקטופ; שליש בגובה).

**הגדרת "מוגמר":**
- לכל אחת מ-3 כרטיסיות העמודים יש תמונה פוטוריאליסטית במקום ה-placeholder.
- התמונות תואמות ויזואלית (אווירה, פלטה, איכות) — לא מערב פראי של סגנונות.
- במובייל: תמונה ברוחב מלא בראש הכרטיסייה, גובה ~180-220px, עם כותרת+טקסט מתחת.
- בדסקטופ: תמונה משמאל (~33% רוחב), טקסט מימין — כפי שכבר מוגדר.
- האייקון והתווית של "רפואה ומחקר" / "פיננסים ובנקאות" / "טכנולוגיה וחדשנות" יכולים להיעלם לטובת התמונה, או להישאר כ-overlay/badge קטן על התמונה. החלטה לסידור בעת ביצוע.

# תכנית ביצוע
1. ליצור תיקייה `website/images/birmingham/` אם לא קיימת.
2. להריץ `nano-banana generate_image` 3 פעמים — פעם לכל עמוד — עם פרומפטים מפורטים באנגלית:
   - **healthcare:** "Photorealistic exterior of UAB hospital medical campus in Birmingham Alabama, modern brick and glass medical building, professional architecture photography, soft afternoon light, clean composition, 4:3 aspect ratio"
   - **finance:** "Photorealistic Birmingham Alabama downtown skyline featuring Regions Financial bank tower at golden hour, modern glass office buildings, urban financial district, professional architectural photography, 4:3 aspect ratio"
   - **technology:** "Photorealistic modern biotech research laboratory interior, scientists in white coats with advanced equipment, clean bright lighting, neutral palette, professional editorial photography, 4:3 aspect ratio"
3. להעביר את 3 הקבצים מ-`generated_imgs/` ל-`website/images/birmingham/pillar-healthcare.jpg` / `pillar-finance.jpg` / `pillar-technology.jpg`.
4. לערוך `website/birmingham.html` שורות ~292-343:
   - להחליף כל `<div class="w-full md:w-1/3 h-48 md:h-56 rounded-xl overflow-hidden bg-surface-container-low ...">` (שמכיל את האייקון) בתג `<img>` מתאים עם `class="w-full md:w-1/3 h-48 md:h-56 rounded-xl object-cover"`.
   - לשמור על המבנה של הכרטיסייה (md:flex-row / md:flex-row-reverse).
   - להחליט אם להשאיר את התווית הקטנה ("רפואה ומחקר" / "פיננסים ובנקאות" / "טכנולוגיה וחדשנות") כ-`<span>` קטן מעל הכותרת או להעיף.
5. לטעון את העמוד מחדש ולוודא ב-mobile + desktop.

# תמונות מצורפות
- sequence/030-image-1.txt

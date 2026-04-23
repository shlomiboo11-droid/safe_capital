/**
 * Event Tab: Basic — only the fields Shlomi enters directly.
 * Derived fields (slug, dates display, hero eyebrow, venue short/full, GCal strings)
 * are computed automatically on the backend when this form is saved.
 */
function renderBasicTab(data) {
  const ev = data.event;
  const c = document.getElementById('tab-basic');

  c.innerHTML = `
    <form id="eventBasicForm" class="space-y-6">

      <!-- Event timing -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">זמן האירוע</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="form-label">תאריך האירוע *</label>
            <input type="date" name="event_date" class="form-input ltr" dir="ltr" value="${ev.event_date ? String(ev.event_date).slice(0,10) : ''}" required>
          </div>
          <div>
            <label class="form-label">שעת התחלה</label>
            <input type="text" name="event_time_start" class="form-input ltr" dir="ltr" value="${escAttr(ev.event_time_start)}" placeholder="19:30">
          </div>
          <div>
            <label class="form-label">שעת סיום</label>
            <input type="text" name="event_time_end" class="form-input ltr" dir="ltr" value="${escAttr(ev.event_time_end)}" placeholder="22:30">
          </div>
        </div>
        <div class="text-xs text-gray-500 mt-3">
          תצוגת התאריך (כותרת Hero וכותרת משנית, Slug, תצוגה מלאה/קצרה, כותרת ליומן גוגל) — מחושבת אוטומטית מהתאריך.
        </div>
      </div>

      <!-- Agenda (collapsible) -->
      <details class="card p-0 overflow-hidden">
        <summary class="p-6 cursor-pointer select-none flex items-center justify-between hover:bg-gray-50">
          <h3 class="text-lg font-bold">סדר היום</h3>
          <span class="material-symbols-outlined text-gray-400 agenda-chevron">expand_more</span>
        </summary>
        <div class="border-t border-gray-200 p-6" id="tab-agenda"></div>
      </details>

      <!-- Venue -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">מיקום</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">שם המקום *</label>
            <input type="text" name="venue_name" class="form-input" value="${escAttr(ev.venue_name)}" placeholder="The Norman" required>
          </div>
          <div>
            <label class="form-label">כתובת (עיר · רחוב) *</label>
            <input type="text" name="venue_address" class="form-input" value="${escAttr(ev.venue_address)}" placeholder="תל-אביב · נחמני 25" required>
          </div>
        </div>
        <div class="text-xs text-gray-500 mt-3">
          תצוגה קצרה (לדוגמה The Norman · TLV) וכתובת מלאה ליומן גוגל — מחושבות אוטומטית.
        </div>
      </div>

      <!-- Capacity -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">קיבולת</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">סה"כ מקומות</label>
            <input type="number" name="seats_total" class="form-input ltr font-inter" dir="ltr" min="1" value="${ev.seats_total || 40}">
          </div>
          <div>
            <label class="form-label">מקומות שנתפסו (עדכון ידני)</label>
            <input type="number" name="seats_taken" class="form-input ltr font-inter" dir="ltr" min="0" value="${ev.seats_taken != null ? ev.seats_taken : 0}">
          </div>
        </div>
      </div>

      <!-- Hero description -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">תיאור Hero</h3>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="form-label">טקסט מתחת לכותרת הראשית</label>
            <textarea name="hero_description" class="form-input" rows="2" placeholder="הצגת העסקה הבאה בבירמינגהאם לקהל סגור של 40 משקיעים. ערב אחד בלבד בתל-אביב.">${escHtml(ev.hero_description)}</textarea>
          </div>
        </div>
      </div>

      <!-- Brief -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">בקצרה</h3>
        <textarea name="brief_text" class="form-input" rows="3" placeholder="הטקסט שמופיע בראש העמוד (תחת בקצרה)">${escHtml(ev.brief_text)}</textarea>
      </div>

      <!-- Toggles -->
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">פרסום</h3>
        <div class="flex flex-wrap gap-6">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="is_published" class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" ${ev.is_published ? 'checked' : ''}>
            <span class="text-sm font-medium">מפורסם (ניתן להפעיל באתר)</span>
          </label>
          <div class="text-sm text-gray-500">
            * כדי שהאירוע יוצג באתר — הוא חייב להיות גם "מפורסם" וגם "פעיל" (כפתור למעלה).
          </div>
        </div>
      </div>

      <div class="flex justify-end">
        <button type="submit" class="btn btn-primary px-8">
          <span class="material-symbols-outlined text-lg">save</span>
          שמור פרטים
        </button>
      </div>
    </form>
  `;

  document.getElementById('eventBasicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {
      event_date: form.event_date.value || null,
      event_time_start: form.event_time_start.value.trim(),
      event_time_end: form.event_time_end.value.trim(),
      venue_name: form.venue_name.value.trim(),
      venue_address: form.venue_address.value.trim(),
      seats_total: parseInt(form.seats_total.value) || 40,
      seats_taken: parseInt(form.seats_taken.value) || 0,
      hero_description: form.hero_description.value.trim(),
      brief_text: form.brief_text.value.trim(),
      is_published: form.is_published.checked
    };
    await saveEventFields(body);
  });
}

// Escape helpers
function escAttr(v) { return v == null ? '' : String(v).replace(/"/g, '&quot;'); }
function escHtml(v) { return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

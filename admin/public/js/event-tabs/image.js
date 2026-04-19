/**
 * Event Tab: Hero Image
 * Simple URL input with preview (upload can be added later).
 */
function renderImageTab(data) {
  const ev = data.event;
  const c = document.getElementById('tab-image');

  c.innerHTML = `
    <form id="eventImageForm" class="space-y-6">
      <div class="card p-6">
        <h3 class="text-lg font-bold mb-4">תמונת Hero</h3>
        <p class="text-sm text-gray-500 mb-4">
          התמונה שמופיעה ברקע של הכותרת הראשית בעמוד האירוע באתר. מומלץ 1920×1080 או גדול יותר.
        </p>

        <div class="mb-4">
          <label class="form-label">קישור לתמונה (URL)</label>
          <input type="text" name="hero_image_url" id="heroImageUrlInput" class="form-input ltr" dir="ltr"
            value="${escAttr(ev.hero_image_url)}" placeholder="https://... or images/investor-nights/hero.jpg">
          <div class="text-xs text-gray-400 mt-1">
            אפשר להזין כתובת מלאה (https://...) או נתיב יחסי באתר (images/...). להעלאה ל-Supabase Storage — בהמשך.
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label">תצוגה מקדימה</label>
          <div id="heroImagePreview" class="rounded-lg overflow-hidden bg-gray-100" style="min-height:200px;">
            ${ev.hero_image_url
              ? `<img src="${escAttr(ev.hero_image_url)}" alt="hero" style="width:100%;max-height:400px;object-fit:cover;display:block;" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'padding:3rem;text-align:center;color:#9ca3af;\\'>לא ניתן לטעון את התמונה</div>'">`
              : `<div style="padding:3rem;text-align:center;color:#9ca3af;">אין תמונה</div>`
            }
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary px-8">
            <span class="material-symbols-outlined text-lg">save</span>
            שמור
          </button>
        </div>
      </div>
    </form>
  `;

  // Live preview on input change
  const input = document.getElementById('heroImageUrlInput');
  input.addEventListener('input', () => {
    const preview = document.getElementById('heroImagePreview');
    const url = input.value.trim();
    if (url) {
      preview.innerHTML = `<img src="${escAttr(url)}" alt="hero" style="width:100%;max-height:400px;object-fit:cover;display:block;">`;
    } else {
      preview.innerHTML = '<div style="padding:3rem;text-align:center;color:#9ca3af;">אין תמונה</div>';
    }
  });

  document.getElementById('eventImageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveEventFields({ hero_image_url: input.value.trim() });
  });
}

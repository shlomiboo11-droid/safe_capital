/**
 * Event Tab: Registrations — read-only table of event registrations.
 */
function renderRegistrationsTab(data) {
  const c = document.getElementById('tab-registrations');
  const regs = data.registrations || [];

  const rangeLabel = (k) => k != null ? `$${k}K` : '—';
  const investedLabel = (v) => v === 'yes' ? 'כן' : v === 'no' ? 'לא · מתעניין' : (v || '—');
  const bool = (b) => b ? 'כן' : 'לא';

  c.innerHTML = `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold">נרשמים לאירוע (${regs.length})</h3>
      </div>

      ${regs.length === 0
        ? '<div class="text-sm text-gray-400 text-center py-6">אין נרשמים עדיין</div>'
        : `
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-gray-200 text-gray-500 text-xs uppercase">
                <tr>
                  <th class="text-right py-2 px-2">שם</th>
                  <th class="text-right py-2 px-2">אימייל</th>
                  <th class="text-right py-2 px-2">טלפון</th>
                  <th class="text-right py-2 px-2">ניסיון</th>
                  <th class="text-right py-2 px-2">טווח</th>
                  <th class="text-right py-2 px-2">מתי</th>
                  <th class="text-right py-2 px-2">מקור</th>
                  <th class="text-right py-2 px-2">תאריך</th>
                </tr>
              </thead>
              <tbody>
                ${regs.map(r => `
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-2 px-2 font-medium">${escHtmlR(r.first_name)} ${escHtmlR(r.last_name)}</td>
                    <td class="py-2 px-2 ltr text-gray-600 font-inter" dir="ltr">${escHtmlR(r.email)}</td>
                    <td class="py-2 px-2 ltr text-gray-600 font-inter" dir="ltr">${escHtmlR(r.phone)}</td>
                    <td class="py-2 px-2">${investedLabel(r.invested_before)}</td>
                    <td class="py-2 px-2 font-inter">${rangeLabel(r.range_k)}</td>
                    <td class="py-2 px-2">${escHtmlR(r.readiness || '—')}</td>
                    <td class="py-2 px-2">${escHtmlR(r.source || '—')}</td>
                    <td class="py-2 px-2 text-xs text-gray-500 font-inter">${formatDate(r.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      }

      <div class="mt-4 text-xs text-gray-400">
        טבלה זו read-only. ניהול נרשמים מתקדם יתווסף בעמוד נפרד בהמשך.
      </div>
    </div>
  `;
}

function escHtmlR(v) { return v == null ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

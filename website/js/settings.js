/**
 * settings.js — Safe Capital website
 * Loads site settings from the admin API and injects them into the page.
 * Hardcoded values in HTML serve as fallbacks if the API is unavailable.
 */

const SETTINGS_API = (window.location.hostname === 'localhost')
  ? 'http://localhost:3000'
  : 'https://safe-capital-admin.vercel.app';

async function loadSiteSettings() {
  try {
    const res = await fetch(SETTINGS_API + '/api/public/settings');
    if (!res.ok) return;
    const settings = await res.json();

    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    // Update text content: <span data-setting="phone_footer">03-123-4567</span>
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      let val = config[key];
      if (!val) return;
      // Format date values for display
      val = formatSettingValue(key, val);
      el.textContent = val;
    });

    // Update href: <a data-setting-href="whatsapp_group" href="...">
    document.querySelectorAll('[data-setting-href]').forEach(el => {
      const val = config[el.dataset.settingHref];
      if (val) el.href = val;
    });

    // Update combined href+text: <a data-setting-href="email_main" data-setting="email_main">
    // Already handled by the two loops above

    return config;
  } catch (err) {
    // Silently fail — hardcoded values in HTML remain as fallback
  }
}

/**
 * Format date values stored as YYYY-MM-DD into display strings.
 */
function formatSettingValue(key, val) {
  if (key === 'last_updated_he' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    const [y, m] = val.split('-');
    return `עודכן לאחרונה: ${HE_MONTHS[parseInt(m, 10) - 1]} ${y}`;
  }
  if (key === 'last_updated_en' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const d = new Date(val + 'T00:00:00');
    return 'Last Updated: ' + d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return val;
}

async function loadSiteStats() {
  try {
    const res = await fetch(SETTINGS_API + '/api/public/stats');
    if (!res.ok) return;
    const stats = await res.json();

    const el = (id) => document.querySelector(`[data-stat="${id}"]`);

    if (el('total_deals') && stats.total_deals != null) {
      el('total_deals').textContent = stats.total_deals;
    }
    if (el('total_raised') && stats.total_raised_display) {
      el('total_raised').textContent = stats.total_raised_display;
    }
    if (el('avg_return') && stats.avg_return) {
      el('avg_return').textContent = stats.avg_return;
    }
  } catch (err) {
    // Silently fail — hardcoded values remain
  }
}

document.addEventListener('DOMContentLoaded', function () {
  loadSiteSettings();
  loadSiteStats();
});

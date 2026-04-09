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
      const val = config[el.dataset.setting];
      if (!val) return;
      if (el.tagName === 'A') {
        el.textContent = val;
      } else {
        el.textContent = val;
      }
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

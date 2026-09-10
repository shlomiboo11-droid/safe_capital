/**
 * deal-display-config.js — Safe Capital
 *
 * Maps deal DB fields into 3 display variants: active / renovation / sold.
 * Consumed by deals.js to render the collapsed-state card.
 *
 * Color rule (position-based, consistent across all 3 types):
 *   - position 1 (right in RTL): navy
 *   - position 2 (center):       crimson
 *   - position 3 (left in RTL):  navy
 *   - progress bar/timeline:     crimson
 */

function getDisplayStatus(deal) {
  if (deal.property_status === 'sold') return 'sold';
  if (deal.fundraising_status === 'completed' || deal.fundraising_status === 'closed' || deal.property_status === 'renovation') return 'renovation';
  return 'active';
}

function formatMoney(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

function minInvestmentOf(deal) {
  return deal.min_investment || 50000;
}

function roiOrDash(val, decimals) {
  if (val == null || val === '') return '—';
  return (decimals ? Number(val).toFixed(decimals) : Math.round(Number(val))) + '%';
}

// Format a months value or a text like "8 חודשים" / "8 months" / "4" as "N חוד׳"
// with "חוד׳" rendered smaller inside the number cell
function monthsShort(textOrNumber) {
  const match = String(textOrNumber == null ? '' : textOrNumber).match(/\d+/);
  if (!match) return '—';
  return `${match[0]}<span style="font-size:0.6875em;font-weight:500;opacity:0.7;margin-right:0.2em;letter-spacing:0">חוד׳</span>`;
}

// Calculate months remaining from project_duration + opens_at_date
function monthsToCompletion(deal) {
  const match = String(deal.project_duration || '').match(/\d+/);
  if (!match) return null;
  const total = parseInt(match[0], 10);
  if (!deal.opens_at_date) return total;
  const elapsed = Math.floor((Date.now() - new Date(deal.opens_at_date).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return Math.max(0, total - elapsed);
}

const DEAL_DISPLAY_CONFIG = {
  active: {
    badge: { style: 'filled-crimson', dotPulse: true, text: () => 'פתוחה להשקעה' },
    numbers: [
      { label: 'השקעה מינ׳',    value: d => formatMoney(minInvestmentOf(d)), color: 'navy' },
      { label: 'תשואה צפויה',   value: d => roiOrDash(d.expected_roi_percent), color: 'crimson' },
      { label: 'תקופה משוערת',  value: d => monthsShort(d.project_duration), color: 'navy' }
    ],
    progress: {
      type: 'fundraising',
      percent: d => d.fundraising_percent || 0,
      remaining: d => formatMoney(Math.max(0, (d.fundraising_goal || 0) - (d.fundraising_raised || 0))) + ' נותר לגייס',
      bottom: d => `${d.investor_count || 0} משקיעים בעסקה`
    },
    cta: { text: 'עוד פרטים על עסקה זו', style: 'filled-navy', expandedText: 'צמצם עסקה' },
    accentStrip: true
  },
  renovation: {
    badge: { style: 'light-navy', check: true, text: () => 'בתהליך שיפוץ' },
    numbers: [
      { label: 'סכום שגויס',    value: d => formatMoney(d.fundraising_raised || d.fundraising_goal || 0), color: 'navy' },
      { label: 'תשואה צפויה',   value: d => roiOrDash(d.expected_roi_percent), color: 'crimson' },
      { label: 'לסיום',          value: d => { const m = monthsToCompletion(d); return m != null ? monthsShort(m) : '—'; }, color: 'navy' }
    ],
    progress: {
      type: 'timeline',
      bottom: d => `${d.investor_count || 0} משקיעים בעסקה`
    },
    cta: { text: 'עוד פרטים על עסקה זו', style: 'filled-navy', expandedText: 'צמצם עסקה' },
    accentStrip: false
  },
  sold: {
    badge: { style: 'filled-navy', doubleCheck: true, text: () => 'נמכרה בהצלחה' },
    numbers: [
      { label: 'רווח שחולק',   value: d => (d.profit_distributed != null ? formatMoney(d.profit_distributed) : '—'), color: 'navy' },
      { label: 'תשואה למשקיע', value: d => roiOrDash(d.actual_roi_percent, 1), color: 'crimson' },
      { label: 'תקופת זמן',    value: d => monthsShort(d.actual_duration_months || d.project_duration), color: 'navy' }
    ],
    progress: {
      type: 'investors-enjoyed',
      bottom: d => `${d.investor_count || 0} משקיעים נהנו מהעסקה הזו`
    },
    cta: { text: 'עוד פרטים על עסקה זו', style: 'filled-navy', expandedText: 'צמצם עסקה' },
    accentStrip: false
  }
};

// ── EXPANDED PANEL CONFIG ────────────────────────────────────────────────────
// Maps each property_status → ordered list of section ids to render in the
// expanded deal panel. Section ids are dispatched to render functions in
// deals.js. Same config drives both desktop and mobile.
//
// Available section ids:
//   fundraising-bar · unified-gallery
//   key-metrics · description · timeline · specs · cost-breakdown · comps
//   renovation-progress · plan-vs-actual · post-sale-summary · whatsapp-cta

const EXPANDED_PANEL_CONFIG = {
  sourcing: [
    'description',
    'unified-gallery',
    'key-metrics',
    'fundraising-bar',
    'specs',
    'comps',
    'cost-breakdown',
    'whatsapp-cta'
  ],
  purchased: [
    'description',
    'unified-gallery',
    'key-metrics',
    'fundraising-bar',
    'specs',
    'comps',
    'cost-breakdown',
    'whatsapp-cta'
  ],
  planning: [
    'description',
    'unified-gallery',
    'key-metrics',
    'fundraising-bar',
    'specs',
    'comps',
    'cost-breakdown',
    'whatsapp-cta'
  ],
  renovation: [
    'description',
    'unified-gallery',
    'key-metrics',
    'fundraising-bar',
    'specs',
    'comps',
    'cost-breakdown',
    'whatsapp-cta'
  ],
  selling: [
    'description',
    'unified-gallery',
    'key-metrics',
    'fundraising-bar',
    'specs',
    'comps',
    'cost-breakdown',
    'whatsapp-cta'
  ],
  sold: [
    'description',
    'unified-gallery',
    'plan-vs-actual',
    'specs',
    'comps',
    'post-sale-summary',
    'whatsapp-cta'
  ]
};

window.getDisplayStatus = getDisplayStatus;
window.DEAL_DISPLAY_CONFIG = DEAL_DISPLAY_CONFIG;
window.EXPANDED_PANEL_CONFIG = EXPANDED_PANEL_CONFIG;
window.formatMoney = formatMoney;

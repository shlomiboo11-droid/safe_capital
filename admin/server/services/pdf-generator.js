/**
 * Safe Capital — Deal Report PDF Generator
 *
 * Renders `pdf-templates/deal-report/template.html` with Handlebars,
 * then converts to PDF via Puppeteer (using system Chrome — no download required).
 *
 * Usage:
 *   const { generateDealReport } = require('./pdf-generator');
 *   const pdfBuffer = await generateDealReport('oxmoor');
 */

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');

// ── Template root (pdf-templates/deal-report/) ──────────────────────────────
const TEMPLATE_ROOT = path.resolve(__dirname, '../../../pdf-templates/deal-report');
const CONTENT_DIR = path.join(TEMPLATE_ROOT, 'content');

// System Chrome on macOS — avoids Puppeteer's bundled-browser download issues.
const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── Handlebars helpers ──────────────────────────────────────────────────────
Handlebars.registerHelper('format', (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return Math.round(num).toLocaleString('en-US');
});

/**
 * Map raw content JSON into the shape the template expects.
 * Keeps the JSON authored-by-humans, and the template authored-by-designer
 * decoupled — transformation lives here.
 */
function shapeTemplateData(content) {
  return {
    meta: content.meta,
    property: content.property,
    financials: {
      ...content.financials,
      costBreakdown: [
        { name: 'עלויות רכישה',            amount: 481997 },
        { name: 'עלויות שיפוץ והכנה',       amount: 505000 },
        { name: 'עלויות מימון',             amount: 71402 },
        { name: 'הוצאות מכירה',             amount: 81000 },
        { name: 'עלויות נוספות והחזקה',     amount: 29140 }
      ]
    },
    specs: [
      { name: 'חדרי שינה',      before: '2',     after: '5' },
      { name: 'חדרי רחצה',      before: '2',     after: '4' },
      { name: 'שטח בנוי (sqft)', before: '1,600', after: '3,000' }
    ],
    comps: [
      { address: '1410 Ardsley Pl, Birmingham, AL',    sqft: 2998, bedrooms: 4, salePrice: 1530000, daysOnMarket: 21 },
      { address: '1511 Grove Pl, Birmingham, AL',      sqft: 2824, bedrooms: 5, salePrice: 1357000, daysOnMarket: 25 },
      { address: '133 E Edgewood Dr, Birmingham, AL',  sqft: 3027, bedrooms: 5, salePrice: 1350000, daysOnMarket: 12 }
    ],
    narrative: content.narrative,
    birmingham: content.birmingham,
    company: content.company,
    method: content.method,
    disclaimer: content.disclaimer
  };
}

/**
 * Generate PDF buffer for a given content slug (e.g. 'oxmoor').
 * Reads content/<slug>.json, compiles template.html, runs Puppeteer.
 */
async function generateDealReport(slug) {
  const contentPath = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(contentPath)) {
    throw new Error(`Content file not found: ${contentPath}`);
  }

  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  const templateSource = fs.readFileSync(path.join(TEMPLATE_ROOT, 'template.html'), 'utf8');
  const template = Handlebars.compile(templateSource);
  const html = template(shapeTemplateData(content));

  const browserOpts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  if (fs.existsSync(SYSTEM_CHROME)) {
    browserOpts.executablePath = SYSTEM_CHROME;
  }

  const browser = await puppeteer.launch(browserOpts);
  try {
    const page = await browser.newPage();
    // Load from file:// so relative paths (assets/, styles.css, fonts) resolve.
    const tmpHtml = path.join(TEMPLATE_ROOT, `.rendered-${slug}.html`);
    fs.writeFileSync(tmpHtml, html);
    await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait extra tick for fonts
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true
    });

    // Clean up rendered file
    try { fs.unlinkSync(tmpHtml); } catch (_) {}

    return pdf;
  } finally {
    await browser.close();
  }
}

module.exports = { generateDealReport };

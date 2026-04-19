/**
 * AI Extractor Service — UNIFIED
 *
 * Single AI call that analyzes ALL deal documents together:
 *   - XLSX calculator → text dump
 *   - Loan agreement PDF → base64
 *   - Renovation plan PDF → base64
 *   - Zillow URL → property info
 *
 * Claude analyzes everything and returns structured JSON.
 */

const fs = require('fs');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

/**
 * Call Claude API with messages (supports documents)
 */
async function callClaude(messages, systemPrompt, maxTokens = 8192) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages
  };

  const resp = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();
  return data.content[0].text;
}

/**
 * Parse JSON from Claude response (handles markdown code blocks)
 */
function parseAIJson(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

// ── JSON Schema for AI response ────────────────────────────────
const JSON_SCHEMA = `{
  "property_info": {
    "name": "כתובת קצרה — רחוב + מספר בלבד, בלי עיר (לדוגמה: 1513 Oxmoor Rd)",
    "full_address": "כתובת מלאה כולל עיר ומדינה",
    "city": "שם העיר",
    "state": "קוד מדינה (2 אותיות, לדוגמה: AL)",
    "project_duration_months": "<מספר חודשים>",
    "specs_before": { "bedrooms": "<מספר>", "bathrooms": "<מספר>", "sqft": "<מספר>" },
    "specs_after": { "bedrooms": "<מספר>", "bathrooms": "<מספר>", "sqft": "<מספר>" }
  },
  "calculator": [
    {
      "category": "שם הקטגוריה בעברית",
      "type": "cost | revenue",
      "items": [
        { "label": "תיאור ההוצאה בעברית", "amount": "<סכום מספרי>" }
      ],
      "total": "<סכום הקטגוריה>"
    }
  ],
  "renovation_plan": {
    "total_cost": "<עלות כוללת>",
    "contractor": "שם הקבלן (אם מופיע במסמכים)",
    "phases": [
      {
        "phase": "<מספר שלב>",
        "title": "שם השלב בעברית",
        "amount": "<סכום>",
        "description_ai": "הסבר בעברית (2-3 משפטים) — מה כוללת העבודה בשלב הזה ולמה היא עולה כך"
      }
    ]
  },
  "financing": {
    "lender_name": "שם המלווה",
    "loan_amount": "<סכום הלוואה>",
    "interest_rate_annual": "<ריבית שנתית באחוזים>",
    "monthly_payment": "<תשלום חודשי>",
    "loan_term_months": "<תקופה בחודשים>",
    "origination_fees": "<עמלות פתיחה>",
    "total_finance_cost": "<סך עלות מימון>"
  },
  "summary": {
    "purchase_price": "<מחיר רכישה>",
    "renovation_cost": "<עלות שיפוץ כוללת>",
    "total_investment": "<סך כל ההשקעה כולל מימון>",
    "arv": "<שווי עתידי / מחיר מכירה צפוי>",
    "selling_costs": "<עלויות מכירה>",
    "net_profit": "<רווח נטו>"
  },
  "deal_description": "3 שורות שיווקיות בעברית שמתארות את העסקה למשקיעים. כתוב בשפה מקצועית ומשכנעת. כלול: מיקום הנכס ויתרונותיו, היקף השיפוץ והתוצאה הצפויה, והתשואה הצפויה למשקיעים.",
  "cross_check": {
    "notes": ["הערה 1 על פערים בין מסמכים", "הערה 2..."]
  }
}`;

// ── System prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `אתה מנתח עסקאות נדל"ן מומחה. אתה מקבל מסמכים של עסקת נדל"ן ומנתח את כולם ביחד.

אתה מבין עברית ואנגלית. המסמכים עשויים להיות דו-לשוניים.

החזר JSON בלבד — ללא טקסט נוסף, ללא markdown, ללא הסברים מחוץ ל-JSON.`;

/**
 * MAIN FUNCTION — Analyze all deal documents together with AI.
 *
 * @param {string} xlsxText - Full text dump of the XLSX calculator
 * @param {Buffer|null} loanPdfBuffer - Loan agreement PDF as Buffer (or null)
 * @param {Buffer|null} renovationPdfBuffer - Renovation plan PDF as Buffer (or null)
 * @param {string|null} zillowUrl - Zillow URL (or null)
 * @returns {object} Structured deal data (same shape as JSON_SCHEMA)
 */
async function analyzeAllDocuments(xlsxText, loanPdfBuffer, renovationPdfBuffer, zillowUrl) {
  // Build the user message content array (text + documents)
  const content = [];

  // Instructions
  content.push({
    type: 'text',
    text: `נתח את כל המסמכים הבאים של עסקת נדל"ן והחזר JSON בפורמט הבא בלבד:

${JSON_SCHEMA}

כללים חשובים:
1. תחשיב עסקה (calculator): רק שורות שהן הוצאות/הכנסות כספיות עם סכום גדול מ-0. לא לכלול: מספר חדרים, שטח (sqft), אחוזים, fix per sqft, חישובים פנימיים. לכל קטגוריה חובה לסמן type: "cost" להוצאות (רכישה, שיפוץ, החזקה, מימון, מכירה) או "revenue" להכנסות (מחיר מכירה צפוי / ARV / תקבולים)
2. כל התוויות חייבות להיות בעברית. אם המקור באנגלית — תרגם
3. ריבית (כמו 0.1075) — זה שיעור, לא סכום כספי. חשב ושים את סך עלות הריבית הכספית
4. תכנית שיפוץ: פרק לשלבים, לכל שלב כתוב הסבר בעברית (2-3 משפטים) שמסביר מה העבודה ולמה זה עולה כך
5. הצלב בין מסמכים: האם עלות השיפוץ במחשבון תואמת לסכום בתכנית השיפוץ? האם הריבית תואמת?
6. שם העסקה = כתובת קצרה (רחוב + מספר בלבד, בלי עיר ובלי מדינה)
7. אם מסמך מסוים לא סופק — השאר את החלק הרלוונטי ריק (null)

עכשיו המסמכים:`
  });

  // XLSX calculator text
  if (xlsxText) {
    content.push({
      type: 'text',
      text: `\n--- מסמך 1: מחשבון פיננסי (Excel) ---\n${xlsxText}\n--- סוף מחשבון ---`
    });
  }

  // Loan PDF
  if (loanPdfBuffer) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: loanPdfBuffer.toString('base64')
      }
    });
    content.push({
      type: 'text',
      text: '↑ מסמך 2: חוזה הלוואה (PDF)'
    });
  } else {
    content.push({
      type: 'text',
      text: '\n--- מסמך 2: חוזה הלוואה — לא סופק ---'
    });
  }

  // Renovation plan PDF
  if (renovationPdfBuffer) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: renovationPdfBuffer.toString('base64')
      }
    });
    content.push({
      type: 'text',
      text: '↑ מסמך 3: תכנית שיפוץ (PDF)'
    });
  } else {
    content.push({
      type: 'text',
      text: '\n--- מסמך 3: תכנית שיפוץ — לא סופק ---'
    });
  }

  // Zillow URL
  if (zillowUrl) {
    content.push({
      type: 'text',
      text: `\n--- מסמך 4: קישור Zillow ---\n${zillowUrl}\nחלץ את הכתובת מה-URL אם אפשר (הפורמט: zillow.com/homedetails/ADDRESS/ZPID)`
    });
  }

  // Call Claude
  const messages = [{ role: 'user', content }];

  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const responseText = await callClaude(messages, SYSTEM_PROMPT, 8192);
      result = parseAIJson(responseText);
      break;
    } catch (err) {
      console.error(`AI extraction attempt ${attempt + 1} failed:`, err.message);
      if (attempt === 1) throw err;
    }
  }

  // Ensure zillow_url is preserved
  if (zillowUrl && result.property_info) {
    result.property_info.zillow_url = zillowUrl;
  }

  return result;
}

module.exports = { analyzeAllDocuments };

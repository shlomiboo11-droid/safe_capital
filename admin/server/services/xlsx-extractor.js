/**
 * XLSX Extractor Service — SIMPLIFIED
 *
 * Single responsibility: convert XLSX file to structured text for AI analysis.
 * All interpretation, categorization, and translation is done by Claude AI.
 */

const XLSX = require('xlsx');
const fs = require('fs');

/**
 * Convert XLSX to a clean text dump suitable for Claude AI analysis.
 * Returns every non-empty cell with its address and value.
 */
function getXlsxAsText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellFormula: false, cellStyles: false });
  let text = '';

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws['!ref']) continue;

    const range = XLSX.utils.decode_range(ws['!ref']);
    text += `=== Sheet: ${name} ===\n`;

    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v !== undefined && cell.v !== '') {
          const col = XLSX.utils.encode_col(c);
          cells.push(`${col}${r + 1}=${JSON.stringify(cell.v)}`);
        }
      }
      if (cells.length > 0) {
        text += `Row ${r + 1}: ${cells.join('  ')}\n`;
      }
    }
  }

  return text;
}

module.exports = { getXlsxAsText };

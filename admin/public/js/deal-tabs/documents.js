/**
 * Tab I: Documents
 */
function renderDocumentsTab(data) {
  const documents = data.documents || [];
  const uploadedDocs = data.uploadedDocs || [];
  const container = document.getElementById('tab-documents');

  const FILE_TYPE_ICONS = {
    pdf: 'picture_as_pdf',
    xlsx: 'table_chart',
    xls: 'table_chart',
    doc: 'description',
    docx: 'description',
    other: 'insert_drive_file'
  };

  container.innerHTML = `
    <!-- Public Documents (shown on website) -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold">מסמכים פומביים</h3>
          <p class="text-sm text-gray-500">מסמכים שמוצגים באתר להורדה</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="addDocument()">
          <span class="material-symbols-outlined text-sm">add</span>
          מסמך חדש
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>שם המסמך</th>
              <th>קישור / קובץ</th>
              <th>סוג</th>
              <th>סדר</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${documents.length === 0 ? '<tr><td colspan="5" class="text-center text-gray-400 py-8">אין מסמכים פומביים. לחץ על "מסמך חדש" כדי להוסיף.</td></tr>' : ''}
            ${documents.map(doc => `
              <tr data-doc-id="${doc.id}">
                <td>
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400">${FILE_TYPE_ICONS[doc.file_type] || FILE_TYPE_ICONS.other}</span>
                    <input type="text" class="form-input text-sm" value="${doc.title || ''}"
                      onchange="updateDocument(${doc.id}, 'title', this.value)">
                  </div>
                </td>
                <td>
                  <input type="url" class="form-input ltr text-sm" dir="ltr" value="${doc.file_url || ''}" placeholder="https://..."
                    onchange="updateDocument(${doc.id}, 'file_url', this.value)">
                </td>
                <td>
                  <select class="form-select text-sm w-24" onchange="updateDocument(${doc.id}, 'file_type', this.value)">
                    <option value="pdf" ${doc.file_type === 'pdf' ? 'selected' : ''}>PDF</option>
                    <option value="xlsx" ${doc.file_type === 'xlsx' ? 'selected' : ''}>XLSX</option>
                    <option value="other" ${doc.file_type === 'other' ? 'selected' : ''}>Other</option>
                  </select>
                </td>
                <td>
                  <input type="number" class="form-input ltr text-sm w-16" value="${doc.sort_order || 0}"
                    onchange="updateDocument(${doc.id}, 'sort_order', parseInt(this.value))">
                </td>
                <td>
                  <div class="flex gap-1">
                    ${doc.file_url ? `
                      <a href="${doc.file_url}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" title="פתח">
                        <span class="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteDocument(${doc.id})" title="מחק">
                      <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- File Upload Section -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold">העלאת קבצים</h3>
          <p class="text-sm text-gray-500">העלה מסמכים לעסקה (מחשבון, חוזים, תמונות)</p>
        </div>
      </div>

      <form id="uploadForm" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="form-label">סוג מסמך</label>
            <select name="document_type" class="form-select text-sm">
              <option value="calculator">מחשבון / תכנית עסקית</option>
              <option value="contractor_agreement">חוזה קבלן</option>
              <option value="loan_application">הסכם הלוואה</option>
              <option value="closing_docs">מסמכי סגירה</option>
              <option value="comps">צילומי Comps</option>
              <option value="before_photos">תמונות לפני</option>
              <option value="renderings">הדמיות</option>
              <option value="after_photos">תמונות אחרי</option>
              <option value="other">אחר</option>
            </select>
          </div>
          <div>
            <label class="form-label">קבצים</label>
            <input type="file" name="files" class="form-input text-sm" multiple
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.mp4,.mov">
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm" id="uploadBtn">
          <span class="material-symbols-outlined text-sm">upload_file</span>
          <span id="uploadBtnText">העלה</span>
          <span id="uploadSpinner" class="hidden">
            <svg class="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            מעלה...
          </span>
        </button>
      </form>
    </div>

    <!-- Uploaded Documents History -->
    ${uploadedDocs.length > 0 ? `
    <div class="card p-6">
      <h3 class="text-lg font-bold mb-4">קבצים שהועלו (${uploadedDocs.length})</h3>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>שם קובץ</th>
              <th>סוג מסמך</th>
              <th>סטטוס חילוץ</th>
              <th>הועלה ע"י</th>
              <th>תאריך</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${uploadedDocs.map(doc => {
              const docTypeLabels = {
                calculator: 'מחשבון',
                contractor_agreement: 'חוזה קבלן',
                loan_application: 'הסכם הלוואה',
                closing_docs: 'מסמכי סגירה',
                comps: 'Comps',
                before_photos: 'תמונות לפני',
                renderings: 'הדמיות',
                after_photos: 'תמונות אחרי',
                other: 'אחר'
              };
              const statusBadge = {
                pending: 'badge-gray',
                processing: 'badge-yellow',
                completed: 'badge-green',
                failed: 'badge-red'
              };
              const statusLabel = {
                pending: 'ממתין',
                processing: 'מעבד',
                completed: 'הושלם',
                failed: 'נכשל'
              };
              return `
                <tr>
                  <td class="text-sm font-inter">${doc.original_filename || ''}</td>
                  <td class="text-sm">${docTypeLabels[doc.document_type] || doc.document_type}</td>
                  <td><span class="badge ${statusBadge[doc.extraction_status] || 'badge-gray'}">${statusLabel[doc.extraction_status] || doc.extraction_status}</span></td>
                  <td class="text-sm text-gray-500">${doc.uploaded_by_name || '--'}</td>
                  <td class="text-sm text-gray-500 font-inter">${formatDateTime(doc.uploaded_at)}</td>
                  <td>
                    <div class="flex gap-1">
                      ${doc.extraction_status === 'pending' ? `
                        <button class="btn btn-primary btn-sm" onclick="extractSingleDoc(${doc.id})" title="חלץ נתונים">
                          <span class="material-symbols-outlined text-sm">auto_awesome</span>
                        </button>
                      ` : ''}
                      ${doc.extraction_status === 'completed' ? `
                        <button class="btn btn-secondary btn-sm" onclick="viewExtractedData(${doc.id})" title="צפה בנתונים">
                          <span class="material-symbols-outlined text-sm">visibility</span>
                        </button>
                      ` : ''}
                      ${doc.file_url ? `
                        <a href="${doc.file_url}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" title="הורד">
                          <span class="material-symbols-outlined text-sm">download</span>
                        </a>
                      ` : ''}
                      <button class="btn btn-danger btn-sm" onclick="deleteUploadedDoc(${doc.id})" title="מחק">
                        <span class="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
  `;

  // Upload form handler
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fileInput = form.querySelector('input[name="files"]');
    const files = fileInput.files;

    if (!files || files.length === 0) {
      showToast('בחר קבצים להעלאה', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('document_type', form.document_type.value);
    for (const file of files) {
      formData.append('files', file);
    }

    // Show loading
    document.getElementById('uploadBtnText').classList.add('hidden');
    document.getElementById('uploadSpinner').classList.remove('hidden');
    document.getElementById('uploadBtn').disabled = true;

    try {
      await API.upload(`/upload/${currentDeal.id}`, formData);
      showToast(`${files.length} קבצים הועלו בהצלחה`);
      form.reset();
      reloadDeal(renderDocumentsTab);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      document.getElementById('uploadBtnText').classList.remove('hidden');
      document.getElementById('uploadSpinner').classList.add('hidden');
      document.getElementById('uploadBtn').disabled = false;
    }
  });
}

async function addDocument() {
  const title = await showPromptModal('שם המסמך', 'הזן שם...');
  if (!title) return;

  // Disable the add button to prevent double-click
  const btn = document.querySelector('[onclick="addDocument()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> שומר...';
  }

  try {
    await API.post(`/deals/${currentDeal.id}/documents`, { title, file_type: 'pdf' });
    showToast('מסמך נוסף');
    reloadDeal(renderDocumentsTab);
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">add</span> מסמך חדש';
    }
  }
}

async function updateDocument(id, field, value) {
  try {
    await API.put(`/deals/${currentDeal.id}/documents/${id}`, { [field]: value });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDocument(id) {
  if (!await confirmAction('האם למחוק את המסמך?')) return;
  try {
    await API.delete(`/deals/${currentDeal.id}/documents/${id}`);
    showToast('המסמך נמחק');
    reloadDeal(renderDocumentsTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUploadedDoc(id) {
  if (!await confirmAction('האם למחוק את הקובץ?')) return;
  try {
    await API.delete(`/upload/${currentDeal.id}/${id}`);
    showToast('הקובץ נמחק');
    reloadDeal(renderDocumentsTab);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function extractSingleDoc(docId) {
  showToast('מחלץ נתונים...');
  try {
    const result = await API.post(`/extract/single/${docId}`, {});
    if (result.status === 'completed') {
      showToast('החילוץ הושלם בהצלחה!');
    } else {
      showToast('החילוץ נכשל', 'error');
    }
    reloadDeal(renderDocumentsTab);
  } catch (err) {
    showToast(`שגיאה: ${err.message}`, 'error');
  }
}

function viewExtractedData(docId) {
  const doc = currentDealData.uploadedDocs.find(d => d.id === docId);
  if (!doc || !doc.extracted_data) {
    showToast('אין נתונים שחולצו', 'error');
    return;
  }

  let data;
  try {
    data = typeof doc.extracted_data === 'string' ? JSON.parse(doc.extracted_data) : doc.extracted_data;
  } catch (e) {
    showToast('שגיאה בקריאת הנתונים', 'error');
    return;
  }

  // Show modal with extracted data
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width: 48rem;">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">נתונים שחולצו — ${doc.original_filename}</h2>
        <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-gray-600">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96" dir="ltr">
        <pre class="text-xs font-mono whitespace-pre-wrap">${JSON.stringify(data, null, 2)}</pre>
      </div>
      <div class="flex gap-3 mt-4">
        <button class="btn btn-primary btn-sm" onclick="applyExtractedData(${docId}); this.closest('.modal-overlay').remove();">
          <span class="material-symbols-outlined text-sm">check</span>
          החל נתונים על העסקה
        </button>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">סגור</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function applyExtractedData(docId) {
  const doc = currentDealData.uploadedDocs.find(d => d.id === docId);
  if (!doc || !doc.extracted_data) return;

  let data;
  try {
    data = typeof doc.extracted_data === 'string' ? JSON.parse(doc.extracted_data) : doc.extracted_data;
  } catch (e) { return; }

  // Build apply payload from extracted data
  const payload = { deal: {}, cost_categories: [], specs: [], comps: [], snapshot: {} };

  // Map common fields
  if (data.property_address || data.address) payload.deal.full_address = data.property_address || data.address;
  if (data.purchase_price) payload.deal.purchase_price = data.purchase_price;
  if (data.loan_amount) payload.deal.description = (payload.deal.description || '') + ' Loan: $' + data.loan_amount;

  // If it has cost items, map them
  if (data.items) {
    payload.cost_categories.push({
      name: 'עלויות שיפוץ',
      items: data.items.map(i => ({ name: i.name, planned_amount: i.amount || 0 }))
    });
  }

  try {
    await API.post(`/extract/apply/${currentDeal.id}`, payload);
    showToast('הנתונים הוחלו בהצלחה!');
    reloadDeal(renderDocumentsTab);
  } catch (err) {
    showToast(`שגיאה: ${err.message}`, 'error');
  }
}

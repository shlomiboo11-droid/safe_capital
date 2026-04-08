const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../helpers/audit');

const router = express.Router();
router.use(authenticate, authorize('super_admin', 'manager'));

// Configure multer
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dealDir = path.join(uploadDir, req.params.dealId || 'general');
    if (!fs.existsSync(dealDir)) fs.mkdirSync(dealDir, { recursive: true });
    cb(null, dealDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      '.xlsx', '.xls', '.csv',
      '.pdf',
      '.jpg', '.jpeg', '.png', '.webp', '.gif',
      '.mp4', '.mov',
      '.doc', '.docx'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// POST /api/upload/:dealId — upload file(s) for a deal
router.post('/:dealId', upload.array('files', 20), async (req, res) => {
  const { dealId } = req.params;
  const { document_type } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const results = [];

    for (const file of req.files) {
      const fileUrl = `/uploads/${dealId}/${file.filename}`;

      const result = await pool.query(`
        INSERT INTO deal_uploaded_documents (deal_id, file_url, original_filename, document_type, extraction_status, uploaded_by)
        VALUES ($1, $2, $3, $4, 'pending', $5)
        RETURNING id
      `, [dealId, fileUrl, file.originalname, document_type || 'other', req.user.id]);

      const newId = result.rows[0].id;
      await logAudit(req.user.id, 'create', 'uploaded_document', newId, {
        deal_id: dealId, filename: file.originalname, document_type
      });

      results.push({
        id: newId,
        file_url: fileUrl,
        original_filename: file.originalname,
        document_type: document_type || 'other'
      });
    }

    res.status(201).json({ files: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/upload/:dealId — list uploaded documents
router.get('/:dealId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ud.*, u.full_name as uploaded_by_name
      FROM deal_uploaded_documents ud
      LEFT JOIN users u ON ud.uploaded_by = u.id
      WHERE ud.deal_id = $1
      ORDER BY ud.uploaded_at DESC
    `, [req.params.dealId]);

    res.json({ documents: result.rows });
  } catch (err) {
    console.error('List uploads error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/upload/:dealId/:docId
router.delete('/:dealId/:docId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deal_uploaded_documents WHERE id = $1 AND deal_id = $2',
      [req.params.docId, req.params.dealId]
    );
    const doc = result.rows[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete physical file
    const filePath = path.join(uploadDir, req.params.dealId, path.basename(doc.file_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM deal_uploaded_documents WHERE id = $1', [req.params.docId]);
    await logAudit(req.user.id, 'delete', 'uploaded_document', req.params.docId, { filename: doc.original_filename });

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('Delete upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

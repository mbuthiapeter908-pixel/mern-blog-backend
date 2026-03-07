const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { ErrorResponse } = require('../middleware/errorHandler');

// Single file upload
router.post('/single', requireAuth, uploadSingle('file'), (req, res) => {
  if (!req.file) {
    return next(new ErrorResponse('No file uploaded', 400));
  }

  res.status(200).json({
    success: true,
    data: {
      filename: req.file.filename,
      url: req.file.url,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
});

// Multiple file upload
router.post('/multiple', requireAuth, uploadMultiple('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse('No files uploaded', 400));
  }

  const files = req.files.map(file => ({
    filename: file.filename,
    url: file.url,
    size: file.size,
    mimetype: file.mimetype
  }));

  res.status(200).json({
    success: true,
    count: files.length,
    data: files
  });
});

// Delete uploaded file
router.delete('/:filename', requireAuth, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../../uploads', filename);

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return next(new ErrorResponse('File not found', 404));
  }

  // Delete file
  fs.unlinkSync(filepath);

  res.status(200).json({
    success: true,
    message: 'File deleted successfully'
  });
});

module.exports = router;
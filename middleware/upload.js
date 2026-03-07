const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ErrorResponse } = require('./errorHandler');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId-timestamp.extension
    const userId = req.auth?.userId || 'anonymous';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${userId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ErrorResponse(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      400
    ), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2097152 // 2MB default
  }
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer error
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ErrorResponse(
            `File too large. Maximum size is ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB`,
            400
          ));
        }
        return next(new ErrorResponse(err.message, 400));
      } else if (err) {
        // Other error
        return next(err);
      }
      
      // Success
      if (req.file) {
        // Generate URL for the uploaded file
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        req.file.url = `${baseUrl}/uploads/${req.file.filename}`;
      }
      
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ErrorResponse(
            `File too large. Maximum size is ${process.env.MAX_FILE_SIZE / 1024 / 1024}MB`,
            400
          ));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new ErrorResponse(
            `Too many files. Maximum is ${maxCount}`,
            400
          ));
        }
        return next(new ErrorResponse(err.message, 400));
      } else if (err) {
        return next(err);
      }
      
      // Generate URLs for uploaded files
      if (req.files && req.files.length > 0) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        req.files = req.files.map(file => ({
          ...file,
          url: `${baseUrl}/uploads/${file.filename}`
        }));
      }
      
      next();
    });
  };
};

module.exports = {
  uploadSingle,
  uploadMultiple
};
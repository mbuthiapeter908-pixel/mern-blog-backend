const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
  moderateComment,
  toggleLike,
  reportComment,
  getUserComments
} = require('../controllers/commentController');

// Public routes
router.get('/post/:postId', getPostComments);
router.get('/user/:userId', getUserComments);  
// Protected routes
router.post('/', requireAuth, createComment);

router.put('/:id', requireAuth, updateComment);
router.delete('/:id', requireAuth, deleteComment);
router.post('/:id/like', requireAuth, toggleLike);
router.post('/:id/report', requireAuth, reportComment);

// Admin only routes
router.put('/:id/moderate', requireAuth, requireAdmin, moderateComment);

module.exports = router;
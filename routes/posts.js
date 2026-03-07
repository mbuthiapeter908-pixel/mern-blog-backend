const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

const {
  getPosts,
  getPostBySlug,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getUserPosts
} = require('../controllers/postController');

/**
 * ======================
 * PUBLIC ROUTES
 * ======================
 */

// Get all posts
router.get('/', getPosts);

// Get posts by a specific user
router.get('/user/:userId', getUserPosts);

// Get post by ID
router.get('/id/:id', getPostById);

// Get post by slug ✅ FIXED
router.get('/slug/:slug', getPostBySlug);

/**
 * ======================
 * PROTECTED ROUTES
 * ======================
 */

// Create new post
router.post(
  '/',
  requireAuth,
  uploadSingle('featuredImage'),
  createPost
);

// Update post
router.put(
  '/:id',
  requireAuth,
  uploadSingle('featuredImage'),
  updatePost
);

// Delete post
router.delete(
  '/:id',
  requireAuth,
  deletePost
);

module.exports = router;
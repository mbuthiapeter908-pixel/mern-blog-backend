const Post = require('../models/Post');
const Category = require('../models/Category');
const Comment = require('../models/Comment');
const { ErrorResponse } = require('../middleware/errorHandler');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const mongoose = require('mongoose');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      author,
      tag,
      status = 'published',
      search,
      sort = '-createdAt'
    } = req.query;

    const query = {};

    if (req.auth?.userId) {
      if (status === 'all') {
        if (req.auth.role === 'admin') {
          // Admin sees all
        } else {
          query.$or = [
            { status: 'published' },
            { authorId: req.auth.userId, status: 'draft' }
          ];
        }
      } else {
        query.status = status;
        if (status === 'draft') {
          query.authorId = req.auth.userId;
        }
      }
    } else {
      query.status = 'published';
    }

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    if (author) query.authorId = author;
    if (tag) query.tags = tag;
    if (search) query.$text = { $search: search };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortOrder = {};
    if (sort.startsWith('-')) {
      sortOrder[sort.substring(1)] = -1;
    } else {
      sortOrder[sort] = 1;
    }

    const posts = await Post.find(query)
      .populate('category', 'name slug color')
      .sort(sortOrder)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: posts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single post by slug
// @route   GET /api/posts/slug/:slug
// @access  Public
exports.getPostBySlug = async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('category', 'name slug color description')
      .lean();

    if (!post) {
      return next(new ErrorResponse('Post not found', 404));
    }

    if (post.status === 'draft') {
      if (!req.auth?.userId || req.auth.userId !== post.authorId) {
        return next(new ErrorResponse('Post not found', 404));
      }
    }

    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single post by ID
// @route   GET /api/posts/id/:id
// @access  Public
exports.getPostById = async (req, res, next) => {
  try {
    console.log('🔍 Looking for post with ID:', req.params.id);

    const post = await Post.findById(req.params.id)
      .populate('category', 'name slug color description')
      .lean();

    if (!post) {
      console.log('❌ Post not found with ID:', req.params.id);
      return next(new ErrorResponse('Post not found', 404));
    }

    console.log('✅ Post found:', post.title);

    if (post.status === 'draft') {
      if (!req.auth?.userId || req.auth.userId !== post.authorId) {
        return next(new ErrorResponse('Post not found', 404));
      }
    }

    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('❌ Error in getPostById:', error);
    next(error);
  }
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    console.log('📝 Creating new post...');
    console.log('Auth user:', req.auth?.userId);
    console.log('Request body:', req.body);

    if (!req.auth?.userId) {
      return next(new ErrorResponse('Not authorized to create posts', 401));
    }

    const requiredFields = ['title', 'content', 'category'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return next(new ErrorResponse(`Missing required field: ${field}`, 400));
      }
    }

    let user;
    try {
      user = await clerkClient.users.getUser(req.auth.userId);
      console.log('✅ User fetched from Clerk:', user.id);
    } catch (clerkError) {
      console.error('❌ Failed to fetch user from Clerk:', clerkError);
      return next(new ErrorResponse('Failed to fetch user details', 500));
    }

    let tags = [];
    if (req.body.tags) {
      try {
        tags = typeof req.body.tags === 'string'
          ? JSON.parse(req.body.tags)
          : req.body.tags;
      } catch (e) {
        tags = req.body.tags.split(',').map(t => t.trim());
      }
    }

    const postData = {
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      tags,
      status: req.body.status || 'draft',
      excerpt: req.body.excerpt || req.body.content.substring(0, 150) + '...',
      authorId: req.auth.userId,
      author: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
        email: user.emailAddresses[0].emailAddress
      }
    };

    if (req.file) {
      console.log('🖼️ File uploaded:', req.file.filename);
      postData.featuredImage = {
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
    }

    let post;
    try {
      post = await Post.create(postData);
      console.log('✅ Post created successfully with ID:', post._id);
    } catch (dbError) {
      console.error('❌ Database error creating post:', dbError);
      return next(new ErrorResponse(`Database error: ${dbError.message}`, 500));
    }

    res.status(201).json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('❌ Unexpected error in createPost:', error);
    next(error);
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return next(new ErrorResponse('Post not found', 404));
    }

    if (post.authorId !== req.auth.userId && req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to update this post', 403));
    }

    if (req.body.tags) {
      try {
        req.body.tags = typeof req.body.tags === 'string'
          ? JSON.parse(req.body.tags)
          : req.body.tags;
      } catch (e) {
        req.body.tags = req.body.tags.split(',').map(t => t.trim());
      }
    }

    if (req.file) {
      req.body.featuredImage = {
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
    }

    post = await Post.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return next(new ErrorResponse('Post not found', 404));
    }

    if (post.authorId !== req.auth.userId && req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to delete this post', 403));
    }

    await Comment.deleteMany({ postId: post._id });

    // Use deleteOne instead of deprecated remove()
    await Post.deleteOne({ _id: post._id });

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's posts
// @route   GET /api/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const query = {
      authorId: userId,
      status: 'published'
    };

    if (req.auth?.userId === userId) {
      delete query.status;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const posts = await Post.find(query)
      .populate('category', 'name slug color')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      count: posts.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: posts
    });
  } catch (error) {
    next(error);
  }
};
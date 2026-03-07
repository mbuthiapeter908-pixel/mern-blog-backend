const Category = require('../models/Category');
const Post = require('../models/Post');
const { ErrorResponse } = require('../middleware/errorHandler');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      //.populate('postCount')
      .sort('name')
      .lean();

    // Get post counts for each category
    const categoryIds = categories.map(c => c._id);
    const postCounts = await Post.aggregate([
      { $match: { category: { $in: categoryIds }, status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    postCounts.forEach(item => {
      countMap[item._id] = item.count;
    });

    categories.forEach(category => {
      category.postCount = countMap[category._id] || 0;
    });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category by slug
// @route   GET /api/categories/:slug
// @access  Public
exports.getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ 
      slug: req.params.slug,
      isActive: true 
    }).lean();

    if (!category) {
      return next(new ErrorResponse('Category not found', 404));
    }

    // Get posts in this category
    const posts = await Post.find({ 
      category: category._id,
      status: 'published' 
    })
      .select('title slug excerpt featuredImage createdAt author views')
      .sort('-createdAt')
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...category,
        posts,
        postCount: posts.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to create categories', 403));
    }

    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to update categories', 403));
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!category) {
      return next(new ErrorResponse('Category not found', 404));
    }

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to delete categories', 403));
    }

    // Check if category has posts
    const postCount = await Post.countDocuments({ category: req.params.id });
    if (postCount > 0) {
      return next(new ErrorResponse(
        'Cannot delete category that has posts. Move or delete posts first.',
        400
      ));
    }

    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return next(new ErrorResponse('Category not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
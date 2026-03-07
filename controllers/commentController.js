const Comment = require('../models/comment');
const Post = require('../models/Post');
const { ErrorResponse } = require('../middleware/errorHandler');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// @desc    Get comments for a post
// @route   GET /api/comments/post/:postId
// @access  Public
exports.getPostComments = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get top-level comments (no parent)
    const comments = await Comment.find({ 
      postId,
      parentComment: null,
      status: 'approved'
    })
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get replies for each comment
    const commentIds = comments.map(c => c._id);
    const replies = await Comment.find({
      parentComment: { $in: commentIds },
      status: 'approved'
    })
      .sort('createdAt')
      .lean();

    // Group replies by parent
    const repliesByParent = {};
    replies.forEach(reply => {
      if (!repliesByParent[reply.parentComment]) {
        repliesByParent[reply.parentComment] = [];
      }
      repliesByParent[reply.parentComment].push(reply);
    });

    // Attach replies to comments
    comments.forEach(comment => {
      comment.replies = repliesByParent[comment._id] || [];
    });

    const total = await Comment.countDocuments({ 
      postId, 
      parentComment: null,
      status: 'approved'
    });

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comments by a specific user
// @route   GET /api/comments/user/:userId
// @access  Public
exports.getUserComments = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const comments = await Comment.find({ authorId: userId })
      .populate('postId', 'title slug')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Comment.countDocuments({ authorId: userId });

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all comments (admin)
// @route   GET /api/comments/admin/all
// @access  Private/Admin
exports.getAllComments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    const comments = await Comment.find(filter)
      .populate('postId', 'title slug')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Comment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: comments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create comment
// @route   POST /api/comments
// @access  Private
exports.createComment = async (req, res, next) => {
  try {
    if (!req.auth?.userId) {
      return next(new ErrorResponse('You must be logged in to comment', 401));
    }

    const { postId, content, parentComment } = req.body;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return next(new ErrorResponse('Post not found', 404));
    }

    // Check if post allows comments
    if (post.disableComments) {
      return next(new ErrorResponse('Comments are disabled for this post', 400));
    }

    // Get user details
    const user = await clerkClient.users.getUser(req.auth.userId);

    // Check if replying to a comment
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists) {
        return next(new ErrorResponse('Parent comment not found', 404));
      }
    }

    const comment = await Comment.create({
      postId,
      authorId: req.auth.userId,
      author: {
        name: `${user.firstName} ${user.lastName}`.trim() || user.username || user.emailAddresses[0].emailAddress,
        image: user.imageUrl,
        email: user.emailAddresses[0].emailAddress
      },
      content,
      parentComment,
      status: 'approved', // Auto-approve for now, can be changed to 'pending' if moderation is desired 
      metadata: {
        userAgent: req.get('user-agent'),
        ipAddress: req.ip
      }
    });

    // If this is a reply, add to parent's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id }
      });
    }

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    // Check ownership
    if (comment.authorId !== req.auth.userId) {
      return next(new ErrorResponse('Not authorized to update this comment', 403));
    }

    comment.content = req.body.content;
    await comment.save();

    res.status(200).json({
      success: true,
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    // Check ownership or admin
    if (comment.authorId !== req.auth.userId && req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to delete this comment', 403));
    }

    // Delete all replies
    await Comment.deleteMany({ parentComment: comment._id });

    // Remove from parent's replies array if this is a reply
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id }
      });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate comment
// @route   PUT /api/comments/:id/moderate
// @access  Private/Admin
exports.moderateComment = async (req, res, next) => {
  try {
    if (req.auth.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to moderate comments', 403));
    }

    const { status } = req.body;

    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        moderatedBy: req.auth.userId,
        moderatedAt: new Date()
      },
      { new: true }
    );

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    res.status(200).json({
      success: true,
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/unlike comment
// @route   POST /api/comments/:id/like
// @access  Private
exports.toggleLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    const hasLiked = comment.likedBy.includes(req.auth.userId);

    if (hasLiked) {
      comment.likedBy = comment.likedBy.filter(id => id !== req.auth.userId);
      comment.likes -= 1;
    } else {
      comment.likedBy.push(req.auth.userId);
      comment.likes += 1;
    }

    await comment.save();

    res.status(200).json({
      success: true,
      data: {
        likes: comment.likes,
        hasLiked: !hasLiked
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report comment
// @route   POST /api/comments/:id/report
// @access  Private
exports.reportComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new ErrorResponse('Comment not found', 404));
    }

    const { reason } = req.body;

    // Check if user already reported
    const alreadyReported = comment.reportedBy.some(
      report => report.userId === req.auth.userId
    );

    if (!alreadyReported) {
      comment.reportedBy.push({
        userId: req.auth.userId,
        reason,
        reportedAt: new Date()
      });
      comment.reports += 1;

      // Auto-flag if multiple reports
      if (comment.reports >= 3) {
        comment.status = 'flagged';
      }

      await comment.save();
    }

    res.status(200).json({
      success: true,
      message: 'Comment reported successfully'
    });
  } catch (error) {
    next(error);
  }
};
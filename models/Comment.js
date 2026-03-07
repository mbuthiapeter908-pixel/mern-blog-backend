const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'Post ID is required'],
    index: true
  },
  authorId: {
    type: String,
    required: [true, 'Author ID is required'],
    index: true
  },
  author: {
    name: {
      type: String,
      required: true
    },
    image: String,
    email: String
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    minlength: [5, 'Comment must be at least 5 characters'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'spam'],
    default: 'pending'
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: String
  }],
  reports: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    userId: String,
    reason: String,
    reportedAt: Date
  }],
  moderatedBy: String,
  moderatedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: Date
  }],
  metadata: {
    userAgent: String,
    ipAddress: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ authorId: 1, createdAt: -1 });
commentSchema.index({ status: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
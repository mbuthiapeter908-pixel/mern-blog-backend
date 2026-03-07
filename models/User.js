const mongoose = require('mongoose');

// Check if model already exists to prevent overwrite
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  firstName: String,
  lastName: String,
  fullName: String,
  username: String,
  profileImage: String,
  role: {
    type: String,
    enum: ['reader', 'author', 'admin'],
    default: 'reader'
  },
  bio: {
    type: String,
    maxlength: 500
  },
  website: String,
  socialLinks: {
    twitter: String,
    github: String,
    linkedin: String
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    postsCount: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    joinedAt: Date,
    lastActive: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
}));

module.exports = User;
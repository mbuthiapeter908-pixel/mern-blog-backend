const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters']
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    content: {
      type: String,
      required: [true, 'Post content is required'],
      minlength: [50, 'Content must be at least 50 characters']
    },

    excerpt: {
      type: String,
      maxlength: [300, 'Excerpt cannot exceed 300 characters']
    },

    authorId: {
      type: String,
      required: true,
      index: true
    },

    author: {
      name: String,
      image: String,
      email: String
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required']
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],

    featuredImage: {
      url: String,
      filename: String,
      size: Number,
      mimetype: String
    },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },

    views: {
      type: Number,
      default: 0
    },

    readingTime: {
      type: Number,
      min: 1
    },

    publishedAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* -----------------------------------------------------
   Helper: Generate slug from title
----------------------------------------------------- */
function generateSlug(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

/* -----------------------------------------------------
   PRE-VALIDATE: Generate slug if missing
----------------------------------------------------- */
postSchema.pre('validate', async function () {
  if (this.title && !this.slug) {
    const baseSlug = generateSlug(this.title);
    this.slug = `${baseSlug}-${Date.now()}`;
    console.log('Generated slug: ' + this.slug);
  }
});

/* -----------------------------------------------------
   PRE-SAVE: Ensure slug uniqueness
----------------------------------------------------- */
postSchema.pre('save', async function () {
  if (!this.isModified('slug')) return;

  const baseSlug = this.slug.replace(/-\d+$/, '');
  let uniqueSlug = this.slug;
  let counter = 1;

  let exists = await this.constructor.findOne({
    slug: uniqueSlug,
    _id: { $ne: this._id }
  });

  while (exists) {
    uniqueSlug = baseSlug + '-' + counter;
    exists = await this.constructor.findOne({
      slug: uniqueSlug,
      _id: { $ne: this._id }
    });
    counter++;
  }

  if (uniqueSlug !== this.slug) {
    console.log('Slug conflict resolved: ' + uniqueSlug);
    this.slug = uniqueSlug;
  }
});

/* -----------------------------------------------------
   PRE-SAVE: Set publishedAt
----------------------------------------------------- */
postSchema.pre('save', async function () {
  if (
    this.isModified('status') &&
    this.status === 'published' &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
    console.log('publishedAt set: ' + this.publishedAt);
  }
});

/* -----------------------------------------------------
   PRE-SAVE: Calculate reading time
----------------------------------------------------- */
postSchema.pre('save', async function () {
  if (this.isModified('content')) {
    const words = this.content.split(/\s+/).length;
    this.readingTime = Math.max(1, Math.ceil(words / 200));
    console.log('Reading time: ' + this.readingTime + ' min');
  }
});

/* -----------------------------------------------------
   PRE-SAVE: Generate excerpt
----------------------------------------------------- */
postSchema.pre('save', async function () {
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 297) + '...';
    console.log('Excerpt generated');
  }
});

/* -----------------------------------------------------
   POST-SAVE: Log success
----------------------------------------------------- */
postSchema.post('save', function (doc) {
  console.log('Post saved successfully');
  console.log('   ID: ' + doc._id);
  console.log('   Title: ' + doc.title);
  console.log('   Slug: ' + doc.slug);
});

/* -----------------------------------------------------
   Model
----------------------------------------------------- */
const Post = mongoose.model('Post', postSchema);

module.exports = Post;
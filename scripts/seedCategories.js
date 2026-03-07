require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Category = require('../models/Category');

const categories = [
  {
    name: 'Technology',
    description: 'Latest tech news, trends, and innovations',
    color: 'blue',
    icon: '💻',
    isActive: true
  },
  {
    name: 'Programming',
    description: 'Coding tutorials, best practices, and tips',
    color: 'green',
    icon: '👨‍💻',
    isActive: true
  },
  {
    name: 'Design',
    description: 'UI/UX, graphic design, and creative inspiration',
    color: 'purple',
    icon: '🎨',
    isActive: true
  },
  {
    name: 'Lifestyle',
    description: 'Health, wellness, and personal development',
    color: 'pink',
    icon: '🌟',
    isActive: true
  },
  {
    name: 'Travel',
    description: 'Travel guides, tips, and destination reviews',
    color: 'orange',
    icon: '✈️',
    isActive: true
  },
  {
    name: 'Food',
    description: 'Recipes, cooking tips, and food culture',
    color: 'red',
    icon: '🍳',
    isActive: true
  }
];

const seedCategories = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');

    // Clear existing categories
    console.log('🗑️  Clearing existing categories...');
    await Category.deleteMany({});
    
    // Insert new categories
    console.log('📝 Inserting new categories...');
    const createdCategories = await Category.insertMany(categories);
    
    console.log(`\n✅ Successfully created ${createdCategories.length} categories:`);
    createdCategories.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.name} (ID: ${cat._id})`);
    });

    // Verify they were saved
    const count = await Category.countDocuments();
    console.log(`\n📊 Total categories in database: ${count}`);

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seed function
seedCategories();
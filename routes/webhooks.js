const express = require('express');
const router = express.Router();
const { Webhook } = require('svix');
const User = require('../models/User');

// Clerk webhook endpoint
router.post('/clerk', async (req, res) => {
  try {
    const payload = req.body;
    const headers = req.headers;

    // Verify webhook signature
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    let evt;
    
    try {
      evt = wh.verify(payload, headers);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const { type, data } = evt;

    // Handle different event types
    switch (type) {
      case 'user.created':
        // Create user in our database
        await User.create({
          clerkId: data.id,
          email: data.email_addresses[0].email_address,
          firstName: data.first_name,
          lastName: data.last_name,
          fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          username: data.username,
          profileImage: data.image_url,
          role: 'reader',
          stats: {
            joinedAt: new Date()
          }
        });
        break;

      case 'user.updated':
        // Update user in our database
        await User.findOneAndUpdate(
          { clerkId: data.id },
          {
            email: data.email_addresses[0].email_address,
            firstName: data.first_name,
            lastName: data.last_name,
            fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
            username: data.username,
            profileImage: data.image_url
          }
        );
        break;

      case 'user.deleted':
        // Delete user from our database
        await User.findOneAndDelete({ clerkId: data.id });
        
        // Optional: Handle user's posts/comments
        // You might want to anonymize them or delete them
        break;

      case 'session.created':
        // Update last login
        await User.findOneAndUpdate(
          { clerkId: data.user_id },
          {
            'metadata.lastLogin': new Date(),
            $inc: { 'metadata.loginCount': 1 }
          }
        );
        break;

      default:
        console.log(`Unhandled webhook event: ${type}`);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook received'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

module.exports = router;
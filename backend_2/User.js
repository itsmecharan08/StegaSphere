const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // For manual users
  username: { 
    type: String, 
    required: function() {
      return !this.isGoogleUser; // Only required for manual users
    },
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    minlength: 3
  },
  
  // For both manual and Google users
  email: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  
  // For manual users
  password: { 
    type: String, 
    required: function() {
      return !this.isGoogleUser; // Only required for manual users
    },
    minlength: 6
  },
  
  // Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String
  },
  verificationTokenExpires: {
    type: Date
  },

  // For Google users
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },

  // Two-Factor Authentication
  twoFactorSecret: {
    type: String
  },
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  tempTwoFactorSecret: {
    type: String // Temporarily store secret during setup
  },
  
  // Common fields
  name: {
    type: String,
    trim: true
  },
  
  profileImage: {
    type: String
  },
  
  isGoogleUser: {
    type: Boolean,
    default: false
  },
  
  subscriptionPlan: {
    type: String,
    enum: ["none", "1month", "1year"],
    default: "none"
  },
  
  subscriptionStart: {
    type: Date,
    default: null
  },
  
  isSubscribed: {
    type: Boolean,
    default: false
  },
  
  // Optional: Add payment tracking
  paymentHistory: [{
    paymentId: String,
    amount: Number,
    currency: String,
    plan: String,
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ["success", "failed", "pending"], default: "success" }
  }]
}, {
  timestamps: true
});

// Create index for better performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ username: 1 }, { sparse: true });

// Method to check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  if (!this.isSubscribed || !this.subscriptionStart || this.subscriptionPlan === "none") {
    return false;
  }
  
  const startDate = new Date(this.subscriptionStart);
  const currentDate = new Date();
  
  if (this.subscriptionPlan === "1month") {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    return currentDate >= startDate && currentDate < endDate;
  }
  
  if (this.subscriptionPlan === "1year") {
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    return currentDate >= startDate && currentDate < endDate;
  }
  
  return false;
};

// Method to activate subscription
userSchema.methods.activateSubscription = function(plan, paymentData = {}) {
  this.subscriptionPlan = plan;
  this.subscriptionStart = new Date();
  this.isSubscribed = true;
  
  // Add to payment history if payment data provided
  if (paymentData.paymentId) {
    if (!this.paymentHistory) {
      this.paymentHistory = [];
    }
    this.paymentHistory.push({
      paymentId: paymentData.paymentId,
      amount: paymentData.amount || 0,
      currency: paymentData.currency || 'INR',
      plan: plan,
      date: new Date(),
      status: 'success'
    });
  }
  
  return this.save();
};

// Method to get subscription info
userSchema.methods.getSubscriptionInfo = function() {
  const isActive = this.hasActiveSubscription();
  let daysRemaining = 0;
  
  if (isActive && this.subscriptionStart && this.subscriptionPlan !== "none") {
    const startDate = new Date(this.subscriptionStart);
    const currentDate = new Date();
    
    if (this.subscriptionPlan === "1month") {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));
    } else if (this.subscriptionPlan === "1year") {
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));
    }
  }
  
  return {
    plan: this.subscriptionPlan,
    isActive: isActive,
    startDate: this.subscriptionStart,
    isSubscribed: this.isSubscribed,
    daysRemaining: daysRemaining
  };
};

// Static method to find or create Google user
userSchema.statics.findOrCreateGoogleUser = async function(googleUserData) {
  const { email, name, googleId, profileImage } = googleUserData;
  
  // Try to find existing user by email or googleId
  let user = await this.findOne({
    $or: [
      { email: email },
      { googleId: googleId || email }
    ]
  });
  
  if (user) {
    // Update Google user info if needed
    if (!user.googleId && googleId) {
      user.googleId = googleId;
    }
    if (!user.name && name) {
      user.name = name;
    }
    if (!user.profileImage && profileImage) {
      user.profileImage = profileImage;
    }
    if (!user.isGoogleUser) {
      user.isGoogleUser = true;
    }
    await user.save();
    return { user, isNew: false };
  }
  
  // Create new Google user
  user = await this.create({
    email: email,
    name: name,
    googleId: googleId || email,
    profileImage: profileImage,
    isGoogleUser: true,
    // Generate a unique username for Google users
    username: `google_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    subscriptionPlan: "none",
    isSubscribed: false,
    subscriptionStart: null
  });
  
  return { user, isNew: true };
};

// Static method to check subscription status
userSchema.statics.checkSubscriptionStatus = async function(userId) {
  const user = await this.findById(userId);
  if (!user) return null;
  
  return user.getSubscriptionInfo();
};

// Pre-save middleware to handle username for Google users
userSchema.pre('save', function(next) {
  // Generate username for Google users if not provided
  if (this.isGoogleUser && !this.username) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    this.username = `google_${timestamp}_${random}`;
  }
  
  // Ensure name field is populated
  if (!this.name && this.username) {
    this.name = this.username;
  }
  
  next();
});

module.exports = mongoose.model("User", userSchema);
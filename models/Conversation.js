const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  currentStep: {
    type: Number,
    default: 1,
    min: 1,
    max: 8
  },
  language: {
    type: String,
    enum: ['en', 'nl'],
    default: 'en'
  },
  data: {
    transaction: String,
    propertyType: String,
    basicFeatures: String,
    highlights: [String],
    uniqueDetail: String,
    targetAudience: String,
    secondaryAudience: String,
    persona: mongoose.Schema.Types.Mixed,
    questions: [String],
    answers: [String],
    finalListing: String,
    approved: {
      persona: { type: Boolean, default: false },
      questions: { type: Boolean, default: false },
      answers: { type: Boolean, default: false }
    }
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    step: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokens: {
      input: Number,
      output: Number,
      total: Number
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  totalTokens: {
    type: Number,
    default: 0
  },
  aiProvider: {
    type: String,
    enum: ['openai', 'gemini'],
    default: 'openai'
  }
}, {
  timestamps: true
});

conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
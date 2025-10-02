const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  language: {
    type: String,
    enum: ['en', 'nl'],
    default: 'en'
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
    timestamp: {
      type: Date,
      default: Date.now
    },
    tokens: {
      input: Number,
      output: Number,
      total: Number
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
  title: { type: String, default: '' },
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
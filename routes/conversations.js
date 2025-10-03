const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const aiService = require('../services/aiService');

const router = express.Router();

// Start conversation - initializes with system prompt
router.post('/start', async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    const sessionId = uuidv4();

    // Initial assistant message
    const initialMessage = {
      role: 'assistant',
      // content: "👋 Welcome to WoningTovenaar! I'm here to guide you with your property listings. How can I assist you today?",
      content: "👋 Welkom bij WoningTovenaar! Ik ben hier om je te helpen met je woningaanbiedingen. Hoe kan ik je vandaag van dienst zijn?",

      timestamp: new Date()
      
    };

    const conversation = new Conversation({
      sessionId,
      language,
      messages: [initialMessage], // save the first assistant message
      status: 'active',
      tokens: { input: 0, output: 0, total: 0 }
    });

    await conversation.save();

    res.json({
      sessionId,
      message: initialMessage.content
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Send message - handles user messages and AI responses
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ message: 'sessionId and message are required' });
    }

    const conversation = await Conversation.findOne({
      sessionId,
      status: 'active'
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found or already completed' });
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
      // user message usually doesn’t have tokens
    });

    // 👇 If first user message, set the title
    const userMessagesCount = conversation.messages.filter(m => m.role === 'user').length;
    if (userMessagesCount === 1) {
      conversation.title = message.substring(0, 50) + (message.length > 50 ? "..." : "");
    }

    // Get AI response
    const response = await aiService.chat(conversation.messages);

    console.log(response, "AI response");

    // Extract tokens safely
    const inputTokens = response.tokens?.input || 0;
    const outputTokens = response.tokens?.output || 0;
    const totalTokens = response.tokens?.total || (inputTokens + outputTokens);

    // Add AI response
    conversation.messages.push({
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      }
    });

    // Update conversation-level tokens
    conversation.tokens.input = (conversation.tokens.input || 0) + inputTokens;
    conversation.tokens.output = (conversation.tokens.output || 0) + outputTokens;
    conversation.tokens.total = (conversation.tokens.total || 0) + totalTokens;

    await conversation.save();

    res.json({
      message: response.content,
      sessionId,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      conversationTokens: conversation.tokens,
      title: conversation.title
    });

  } catch (error) {
    console.error('Message processing error:', error);
    res.status(500).json({ message: 'Server error processing your message. Please try again.' });
  }
});



// Get conversation history
router.get('/:sessionId', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      sessionId: req.params.sessionId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json({
      sessionId: conversation.sessionId,
      messages: conversation.messages,
      tokens: conversation.tokens,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List conversations
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('sessionId status title createdAt updatedAt tokens');

    res.json(conversations);
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// End conversation
router.post('/:sessionId/end', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      sessionId: req.params.sessionId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    conversation.status = 'completed';
    await conversation.save();

    res.json({
      message: 'Conversation ended successfully',
      sessionId: conversation.sessionId,
      tokens: conversation.tokens
    });
  } catch (error) {
    console.error('End conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT_PATH = path.join(__dirname, '../woningtovenaar-prompt.txt');

class AIService {
  constructor() {
    this.preferredProvider = 'openai';
    this.systemPrompt = this.loadSystemPrompt();
    // Adjust based on your needs - this keeps last N message pairs
    this.maxMessageHistory = 10; // Keep last 10 messages (5 exchanges)
  }

  loadSystemPrompt() {
    try {
      return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
    } catch (error) {
      console.error('Error loading system prompt:', error);
      throw new Error('Failed to load WoningTovenaar system prompt');
    }
  }

  /**
   * Truncate message history to prevent context overflow
   * Keeps system prompt + recent conversation history
   */
  truncateMessages(messages) {
    // If messages are within limit, return as-is
    if (messages.length <= this.maxMessageHistory) {
      return messages;
    }

    // Keep the most recent messages
    // Always keep system message if it exists
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    // Take last N messages
    const recentMessages = nonSystemMessages.slice(-this.maxMessageHistory);
    
    return [...systemMessages, ...recentMessages];
  }

  async callOpenAI(messages) {
    try {
      // Truncate messages to manage context length
      const truncatedMessages = this.truncateMessages(messages);

      // Prepare messages with system prompt
      const fullMessages = [
        { role: 'system', content: this.systemPrompt },
        ...truncatedMessages
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: fullMessages,
        // max_tokens: 2000,
        // temperature: 0.7,
      });
      

      return {
        content: response.choices[0].message.content,
        tokens: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens
        },
        provider: 'openai'
      };
    } catch (error) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw new Error(`Failed to get AI response from OpenAI: ${error.message}`);
    }
  }

  async callGemini(messages) {
    try {
      // Truncate messages for Gemini as well
      const truncatedMessages = this.truncateMessages(messages);

      // Build conversation history for Gemini
      const geminiContents = truncatedMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          system_instruction: {
            parts: [{ text: this.systemPrompt }]
          },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Gemini doesn't always provide token counts in the same way
      const tokens = {
        input: response.data?.usageMetadata?.promptTokenCount || 0,
        output: response.data?.usageMetadata?.candidatesTokenCount || 0,
        total: response.data?.usageMetadata?.totalTokenCount || 0
      };

      return { 
        content, 
        tokens,
        provider: 'gemini' 
      };
    } catch (error) {
      console.error("Gemini API Error:", error.response?.data || error.message);
      throw new Error(`Failed to get AI response from Gemini: ${error.message}`);
    }
  }

  // Main chat method with fallback
  async chat(messages, forceProvider = null) {
    const provider = forceProvider || this.preferredProvider;
    
    try {
      if (provider === 'openai') {
        return await this.callOpenAI(messages);
      } else {
        return await this.callGemini(messages);
      }
    } catch (error) {
      // Fallback mechanism
      const fallbackProvider = provider === 'openai' ? 'gemini' : 'openai';
      console.log(`Primary provider failed, falling back to ${fallbackProvider}`);
      
      try {
        if (fallbackProvider === 'openai') {
          return await this.callOpenAI(messages);
        } else {
          return await this.callGemini(messages);
        }
      } catch (fallbackError) {
        console.error('Both providers failed:', fallbackError);
        throw new Error('All AI providers failed. Please try again later.');
      }
    }
  }
}

module.exports = new AIService();
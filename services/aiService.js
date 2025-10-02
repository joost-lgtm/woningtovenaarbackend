const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Load the WoningTovenaar system prompt from file
const SYSTEM_PROMPT_PATH = path.join(__dirname, '../woningtovenaar-prompt.txt');

class AIService {
  constructor() {
    this.preferredProvider = 'openai';
    this.systemPrompt = this.loadSystemPrompt();
  }

  loadSystemPrompt() {
    try {
      return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
    } catch (error) {
      console.error('Error loading system prompt:', error);
      throw new Error('Failed to load WoningTovenaar system prompt');
    }
  }

  async callOpenAI(messages) {
    try {
      // Prepare messages with system prompt
      const fullMessages = [
        { role: 'system', content: this.systemPrompt },
        ...messages
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: fullMessages,
        max_tokens: 2000,
        temperature: 0.7
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
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to get AI response from OpenAI');
    }
  }

  async callGemini(messages) {
    try {
      // Only take last user message
      const userMessage = messages.findLast(msg => msg.role === 'user')?.content || "";
      const fullPrompt = `${this.systemPrompt}\n\n${userMessage}`;
  
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: fullPrompt }]
            }
          ]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
  
      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { content, provider: 'gemini' };
    } catch (error) {
      console.error("Gemini API Error:", error.response?.data || error.message);
      throw new Error('Failed to get AI response from Gemini');
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
      console.log(`Falling back to ${fallbackProvider}`);
      
      if (fallbackProvider === 'openai') {
        return await this.callOpenAI(messages);
      } else {
        return await this.callGemini(messages);
      }
    }
  }
}

module.exports = new AIService();
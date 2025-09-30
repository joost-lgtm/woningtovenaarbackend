const OpenAI = require('openai');
const axios = require('axios');
const { SYSTEM_PROMPTS } = require('../prompts');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class AIService {
  constructor() {
    this.preferredProvider = 'openai'; // Dynamic switching logic
  }

  async callOpenAI(prompt, systemPrompt = '', maxTokens = 1000) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ].filter(msg => msg.content);

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        max_tokens: maxTokens,
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

  async callGemini(prompt, systemPrompt = '') {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}` : prompt;
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: fullPrompt }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.candidates[0].content.parts[0].text;
      const inputTokens = response.data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.data.usageMetadata?.candidatesTokenCount || 0;

      return {
        content,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens
        },
        provider: 'gemini'
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Failed to get AI response from Gemini');
    }
  }

  // Smart orchestration - tries OpenAI first, falls back to Gemini
  async callAI(prompt, systemPrompt = '', maxTokens = 1000, forceProvider = null) {
    const provider = forceProvider || this.preferredProvider;
    
    try {
      if (provider === 'openai') {
        return await this.callOpenAI(prompt, systemPrompt, maxTokens);
      } else {
        return await this.callGemini(prompt, systemPrompt);
      }
    } catch (error) {
      // Fallback mechanism
      const fallbackProvider = provider === 'openai' ? 'gemini' : 'openai';
      console.log(`Falling back to ${fallbackProvider}`);
      
      if (fallbackProvider === 'openai') {
        return await this.callOpenAI(prompt, systemPrompt, maxTokens);
      } else {
        return await this.callGemini(prompt, systemPrompt);
      }
    }
  }

  async generatePersona(conversationData) {
    const { transaction, propertyType, targetAudience, basicFeatures } = conversationData;
    
    const prompt = `Create a detailed buyer persona for:
    - Transaction: ${transaction}
    - Property: ${propertyType}
    - Target Audience: ${targetAudience}
    - Basic Features: ${basicFeatures}
    
    Generate a comprehensive persona profile.`;

    return this.callAI(prompt, SYSTEM_PROMPTS.PERSONA_GENERATOR, 800);
  }

  async generateQuestions(conversationData) {
    const { transaction, propertyType, targetAudience } = conversationData;
    
    const prompt = `Generate top 10 questions for:
    - Transaction: ${transaction}
    - Property: ${propertyType}  
    - Target Audience: ${targetAudience}`;

    return this.callAI(prompt, SYSTEM_PROMPTS.QUESTIONS_GENERATOR, 400);
  }

  async generateAnswers(questions, conversationData) {
    const prompt = `Answer these questions based on the property data:
    Questions: ${JSON.stringify(questions)}
    Property Data: ${JSON.stringify(conversationData)}`;

    return this.callAI(prompt, SYSTEM_PROMPTS.ANSWERS_GENERATOR, 600);
  }

  async generateListing(conversationData) {
    const prompt = `Generate a complete property listing using ALL this data:
    ${JSON.stringify(conversationData, null, 2)}
    
    Ensure all user inputs are visibly incorporated into the final text.`;

    return this.callAI(prompt, SYSTEM_PROMPTS.LISTING_GENERATOR, 1200);
  }
}

module.exports = new AIService();
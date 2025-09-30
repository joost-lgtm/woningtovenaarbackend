const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const aiService = require('../services/aiService');
const { PROPERTY_HIGHLIGHTS, TRANSLATIONS } = require('../prompts');

const router = express.Router();

// Enhanced start conversation with motivational messaging
router.post('/start', async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    const sessionId = uuidv4();

    const conversation = new Conversation({
      sessionId,
      language,
      currentStep: 1,
      data: {},
      messages: [
        {
          role: 'assistant',
          content: TRANSLATIONS[language].step1,
          step: 1,
          createdAt: new Date()
        }
      ],
      status: 'active',
      totalTokens: 0
    });

    await conversation.save();

    res.json({
      sessionId,
      currentStep: 1,
      message: TRANSLATIONS[language].step1
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enhanced step processing with validation and better flow control
router.post('/step', async (req, res) => {
  try {
    const { sessionId, message, action, data } = req.body;
    
    console.log('Step processing:', { sessionId, message, action, data });

    const conversation = await Conversation.findOne({
      sessionId,
      status: 'active'
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Validation layer - check if input is valid for current step
    const validationResult = validateStepInput(conversation.currentStep, message, action, data);
    if (!validationResult.valid) {
      // Don't advance step, return validation error
      const errorMessage = {
        role: 'assistant',
        content: validationResult.message,
        step: conversation.currentStep,
        createdAt: new Date()
      };
      conversation.messages.push(errorMessage);
      await conversation.save();
      
      return res.json({
        message: validationResult.message,
        currentStep: conversation.currentStep,
        sessionId,
        validationError: true,
        conversationData: conversation.data
      });
    }

    // Add user message if provided
    if (message && action === 'continue') {
      conversation.messages.push({
        role: 'user',
        content: message,
        step: conversation.currentStep,
        createdAt: new Date()
      });
    }

    let response;
    let nextStep = conversation.currentStep;

    // Enhanced step handling with better flow control
    switch (conversation.currentStep) {
      case 1: // Transaction type
        response = await handleTransactionStep(conversation, message);
        nextStep = 2;
        break;
      case 2: // Property type
        response = await handlePropertyTypeStep(conversation, message);
        nextStep = 3;
        break;
      case 3: // Basic features
        response = await handleBasicFeaturesStep(conversation, message);
        nextStep = 4;
        break;
      case 4: // Highlights
        response = await handleHighlightsStep(conversation, data, action);
        if (response.success) nextStep = 5;
        break;
      case 5: // Target audience
        response = await handleTargetAudienceStep(conversation, message);
        nextStep = 6;
        break;
      case 6: // Enhanced Persona & Q&A generation with editing support
        response = await handlePersonaStep(conversation, action, data, message);
        // Only advance to step 7 when all substeps are approved
        if (action === 'approve_answers' && !action.startsWith('update_')) {
          nextStep = 7;
        }
        break;
      case 7: // Final generation - don't auto-trigger
        if (message === 'generate final' || action === 'generate_final') {
          response = await handleFinalGenerationStep(conversation);
          nextStep = 8;
        } else {
          response = { 
            message: TRANSLATIONS[conversation.language].step7_ready,
            ready: true,
            data: conversation.data 
          };
        }
        break;
      case 8: // Complete
        response = { message: 'Conversation completed', completed: true };
        break;
      default:
        response = { message: 'Invalid step' };
    }

    // Store the response data properly
    conversation.messages.push({
      role: 'assistant',
      content: response.message || 'Processing completed',
      step: nextStep,
      tokens: response.tokens,
      data: response,
      createdAt: new Date()
    });

    if (response.tokens) {
      conversation.totalTokens += response.tokens.total || 0;
    }

    conversation.currentStep = nextStep;

    if (nextStep === 8) {
      conversation.status = 'completed';
    }

    await conversation.save();

    res.json({
      ...response,
      currentStep: nextStep,
      sessionId,
      conversationData: conversation.data
    });

  } catch (error) {
    console.error('Process step error:', error);
    res.status(500).json({ message: 'Server error processing your request. Please try again.' });
  }
});

// Get conversation
router.get('/:sessionId', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      sessionId: req.params.sessionId
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json(conversation);
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
      .select('sessionId currentStep status createdAt updatedAt data.transaction data.propertyType totalTokens');

    res.json(conversations);
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// NEW: Enhanced validation function
function validateStepInput(step, message, action, data) {
  switch (step) {
    case 1: // Transaction validation
      if (action === 'continue' && message) {
        const lowerMessage = message.toLowerCase().trim();
        if (!lowerMessage.includes('sale') && !lowerMessage.includes('rent') && 
            !lowerMessage.includes('verkoop') && !lowerMessage.includes('huur')) {
          return {
            valid: false,
            message: "I need to know if this is for 'sale' or 'rent'. Please reply with either 'sale' or 'rent'."
          };
        }
      }
      break;
    case 2: // Property type validation
      if (action === 'continue' && message) {
        const lowerMessage = message.toLowerCase().trim();
        const propertyTypes = ['apartment', 'house', 'studio', 'villa', 'townhouse', 'condo', 'flat', 'maisonette'];
        if (!propertyTypes.some(type => lowerMessage.includes(type)) && lowerMessage.length < 4) {
          return {
            valid: false,
            message: "Please specify a valid property type such as 'apartment', 'house', 'studio', or 'villa'."
          };
        }
      }
      break;
    case 3: // Basic features validation
      if (action === 'continue' && message && message.trim().length < 10) {
        return {
          valid: false,
          message: "Please provide more detailed information about the property features (e.g., size, rooms, year built, etc.)."
        };
      }
      break;
    case 4: // Highlights validation
      if (action === 'highlights' && (!data?.highlights || data.highlights.length === 0)) {
        return {
          valid: false,
          message: "Please select at least one highlight that describes your property."
        };
      }
      break;
    case 5: // Target audience validation
      if (action === 'continue' && message && message.trim().length < 3) {
        return {
          valid: false,
          message: "Please specify your target audience (e.g., 'first-time buyer', 'family', 'investor', 'senior', 'expat')."
        };
      }
      break;
  }
  return { valid: true };
}

// Helper functions with enhanced messaging
async function handleTransactionStep(conversation, message) {
  const transaction = message.toLowerCase().includes('sale') || message.toLowerCase().includes('verkoop') ? 'sale' : 'rent';
  if (!conversation.data) conversation.data = {};
  conversation.data.transaction = transaction;
  
  // Add motivational nudge
  const motivationalMessage = transaction === 'sale' ? 
    "Great! We're creating a listing to sell your property. Let's make it irresistible to buyers! 🎯" : 
    "Perfect! We're creating a rental listing that will attract the right tenants. Let's get started! 🏠";
  
  return {
    message: motivationalMessage + "\n\n" + TRANSLATIONS[conversation.language].step2,
    transaction,
    data: { transaction }
  };
}

async function handlePropertyTypeStep(conversation, message) {
  const propertyType = message.toLowerCase().trim();
  conversation.data.propertyType = propertyType;
  
  const highlights = PROPERTY_HIGHLIGHTS[propertyType] || PROPERTY_HIGHLIGHTS.apartment;
  
  // Add encouraging message
  const encouragement = `Excellent choice! ${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}s are always in demand. Let's highlight what makes yours special! ✨`;
  
  return {
    message: encouragement + "\n\n" + TRANSLATIONS[conversation.language].step3,
    propertyType,
    highlights,
    data: { transaction: conversation.data.transaction, propertyType }
  };
}

async function handleBasicFeaturesStep(conversation, message) {
  conversation.data.basicFeatures = message;
  
  const highlights = PROPERTY_HIGHLIGHTS[conversation.data.propertyType] || PROPERTY_HIGHLIGHTS.apartment;
  
  // Add progress encouragement
  const progressMessage = "Perfect! I've got all the key details. Now let's identify the standout features that will grab attention! 🌟";
  
  return {
    message: progressMessage + "\n\n" + TRANSLATIONS[conversation.language].step4,
    highlights,
    data: { 
      transaction: conversation.data.transaction, 
      propertyType: conversation.data.propertyType,
      basicFeatures: message 
    }
  };
}

// Enhanced highlights handling
async function handleHighlightsStep(conversation, data, action) {
  console.log('Highlights step - Action:', action, 'Data:', data);
  
  if (action === 'highlights' && data) {
    // Validate the data structure
    if (!data.highlights || !Array.isArray(data.highlights) || data.highlights.length === 0) {
      const highlights = PROPERTY_HIGHLIGHTS[conversation.data.propertyType] || PROPERTY_HIGHLIGHTS.apartment;
      
      return {
        message: 'Please select at least one highlight that best describes your property.',
        highlights,
        data: conversation.data,
        success: false
      };
    }
    
    // Save the highlights data
    conversation.data.highlights = data.highlights;
    conversation.data.uniqueDetail = data.uniqueDetail || '';
    
    // Add motivational message
    const selectedCount = data.highlights.length;
    const encouragement = `Fantastic! You've selected ${selectedCount} compelling highlights. These will really make your property stand out! 🚀`;
    
    return {
      message: encouragement + "\n\n" + TRANSLATIONS[conversation.language].step5,
      data: conversation.data,
      success: true
    };
  }
  
  // If no action or wrong action, return highlights for selection
  const highlights = PROPERTY_HIGHLIGHTS[conversation.data.propertyType] || PROPERTY_HIGHLIGHTS.apartment;
  
  return {
    message: TRANSLATIONS[conversation.language].step4,
    highlights,
    data: conversation.data,
    success: false
  };
}

async function handleTargetAudienceStep(conversation, message) {
  conversation.data.targetAudience = message;
  
  // Generate persona with encouragement
  try {
    const audienceType = message.toLowerCase();
    const encouragement = `Great choice! Understanding your ${audienceType} audience will help us craft the perfect message. Let me create a detailed buyer persona... 🎯`;
    
    const personaResponse = await aiService.generatePersona(conversation.data);
    const persona = JSON.parse(personaResponse.content);
    
    conversation.data.persona = persona;
    
    return {
      message: encouragement + "\n\n" + TRANSLATIONS[conversation.language].step6a,
      persona,
      tokens: personaResponse.tokens,
      substep: 'persona',
      data: conversation.data
    };
  } catch (error) {
    console.error('Persona generation error:', error);
    return {
      message: 'I encountered an issue generating the persona. Let me try again with a different approach.',
      error: true,
      data: conversation.data
    };
  }
}

// Enhanced persona step with editing support
async function handlePersonaStep(conversation, action, data, message) {
  if (!conversation.data.approved) {
    conversation.data.approved = {};
  }
  
  switch (action) {
    case 'approve_persona':
      conversation.data.approved.persona = true;
      
      try {
        const questionsResponse = await aiService.generateQuestions(conversation.data);
        const questions = JSON.parse(questionsResponse.content);
        
        conversation.data.questions = questions;
        
        const encouragement = "Perfect! Now I'll generate the top 10 questions your target audience typically asks. These insights will make your listing more compelling! 💡";
        
        return {
          message: encouragement + "\n\n" + TRANSLATIONS[conversation.language].step6b,
          questions,
          tokens: questionsResponse.tokens,
          substep: 'questions',
          data: conversation.data
        };
      } catch (error) {
        console.error('Questions generation error:', error);
        return {
          message: 'Error generating questions. Please try again.',
          error: true,
          data: conversation.data
        };
      }
      
    case 'approve_questions':
      conversation.data.approved.questions = true;
      
      try {
        const answersResponse = await aiService.generateAnswers(conversation.data.questions, conversation.data);
        const answers = JSON.parse(answersResponse.content);
        
        conversation.data.answers = answers;
        
        const encouragement = "Excellent! Here are compelling answers that address your audience's key concerns. These will build trust and drive action! 🎯";
        
        return {
          message: encouragement + "\n\n" + TRANSLATIONS[conversation.language].step6c,
          answers,
          questions: conversation.data.questions,
          tokens: answersResponse.tokens,
          substep: 'answers',
          data: conversation.data
        };
      } catch (error) {
        console.error('Answers generation error:', error);
        return {
          message: 'Error generating answers. Please try again.',
          error: true,
          data: conversation.data
        };
      }
      
    case 'approve_answers':
      conversation.data.approved.answers = true;
      
      const readyMessage = "Outstanding! We have everything needed to create your professional property listing. You're ready for the final step! 🎉";
      
      return {
        message: readyMessage + "\n\n" + TRANSLATIONS[conversation.language].step7,
        ready: true,
        data: conversation.data
      };

    // NEW: Handle editing actions
    case 'update_persona':
      if (data && data.persona) {
        conversation.data.persona = data.persona;
        return {
          message: "Great! I've updated the persona with your changes. Does this look better now?",
          persona: data.persona,
          substep: 'persona',
          data: conversation.data
        };
      }
      break;
      
    case 'update_questions':
      if (data && data.questions) {
        conversation.data.questions = data.questions;
        return {
          message: "Perfect! I've updated the questions with your modifications. These will work much better!",
          questions: data.questions,
          substep: 'questions',
          data: conversation.data
        };
      }
      break;
      
    case 'update_answers':
      if (data && data.answers) {
        conversation.data.answers = data.answers;
        return {
          message: "Excellent! I've saved your customized answers. These are much more targeted now!",
          answers: data.answers,
          questions: conversation.data.questions,
          substep: 'answers',
          data: conversation.data
        };
      }
      break;
      
    // Handle regeneration requests
    default:
      if (message && message.includes('regenerate')) {
        if (message.includes('persona')) {
          try {
            const personaResponse = await aiService.generatePersona(conversation.data);
            const persona = JSON.parse(personaResponse.content);
            conversation.data.persona = persona;
            
            return {
              message: "Here's a fresh take on the persona. Does this version work better for you?",
              persona,
              tokens: personaResponse.tokens,
              substep: 'persona',
              data: conversation.data
            };
          } catch (error) {
            return {
              message: 'Error regenerating persona. Please try again.',
              error: true,
              data: conversation.data
            };
          }
        } else if (message.includes('questions')) {
          try {
            const questionsResponse = await aiService.generateQuestions(conversation.data);
            const questions = JSON.parse(questionsResponse.content);
            conversation.data.questions = questions;
            
            return {
              message: "Here are fresh questions based on your target audience. Much better now!",
              questions,
              tokens: questionsResponse.tokens,
              substep: 'questions',
              data: conversation.data
            };
          } catch (error) {
            return {
              message: 'Error regenerating questions. Please try again.',
              error: true,
              data: conversation.data
            };
          }
        } else if (message.includes('answers')) {
          try {
            const answersResponse = await aiService.generateAnswers(conversation.data.questions, conversation.data);
            const answers = JSON.parse(answersResponse.content);
            conversation.data.answers = answers;
            
            return {
              message: "Here are revised answers that should be more compelling!",
              answers,
              questions: conversation.data.questions,
              tokens: answersResponse.tokens,
              substep: 'answers',
              data: conversation.data
            };
          } catch (error) {
            return {
              message: 'Error regenerating answers. Please try again.',
              error: true,
              data: conversation.data
            };
          }
        }
      }
      
      return { 
        message: 'I can help you approve, edit, or regenerate the current content. What would you like to do?',
        data: conversation.data
      };
  }
}

async function handleFinalGenerationStep(conversation) {
  try {
    const finalMessage = "🎉 Creating your professional property listing now! This combines all your inputs into a compelling, market-ready description...";
    
    const listingResponse = await aiService.generateListing(conversation.data);
    conversation.data.finalListing = listingResponse.content;
    
    // Quality check
    const qualityCheck = performQualityCheck(conversation.data, listingResponse.content);
    
    const completionMessage = "🎊 Congratulations! Your professional property listing is complete! This listing incorporates all your specific details and is designed to attract your target audience effectively.";
    
    return {
      message: completionMessage + "\n\n" + TRANSLATIONS[conversation.language].step8,
      finalListing: listingResponse.content,
      qualityCheck,
      tokens: listingResponse.tokens,
      completed: true,
      data: conversation.data
    };
  } catch (error) {
    console.error('Final listing generation error:', error);
    return {
      message: 'I encountered an issue generating your final listing. Let me try a different approach...',
      error: true,
      data: conversation.data
    };
  }
}

// Enhanced quality check function
function performQualityCheck(conversationData, finalListing) {
  const checks = {
    personaFit: checkPersonaAlignment(conversationData, finalListing),
    factuality: checkFactualAccuracy(conversationData, finalListing),
    questionsCovered: checkQuestionsCoverage(conversationData, finalListing),
    readability: checkReadability(finalListing),
    compliance: checkCompliance(finalListing),
    cta: checkCallToAction(conversationData, finalListing)
  };
  
  const score = Object.values(checks).reduce((sum, check) => sum + (check.passed ? 1 : 0), 0);
  
  return {
    ...checks,
    overallScore: `${score}/6`,
    passed: score >= 5,
    note: score >= 5 ? 
      "High-quality listing that effectively addresses target audience needs and incorporates all provided information." :
      "Some areas need attention for optimal performance."
  };
}

function checkPersonaAlignment(data, listing) {
  const audience = data.targetAudience;
  
  const audienceKeywords = {
    'first-time buyer': ['starter', 'ready', 'affordable', 'move-in', 'perfect for'],
    'family': ['space', 'rooms', 'garden', 'school', 'safe', 'children'],
    'investor': ['rental', 'yield', 'maintenance', 'location', 'return'],
    'senior': ['accessible', 'quiet', 'convenient', 'low maintenance', 'comfortable'],
    'expat': ['available', 'furnished', 'transport', 'international', 'central']
  };
  
  const keywords = audienceKeywords[audience] || [];
  const matches = keywords.filter(keyword => listing.toLowerCase().includes(keyword));
  
  return {
    passed: matches.length >= 2,
    details: `Persona alignment: ${matches.length}/${keywords.length} key themes addressed`
  };
}

function checkFactualAccuracy(data, listing) {
  let included = 0;
  let total = 0;
  
  if (data.basicFeatures) {
    total++;
    if (listing.includes('m²') || listing.includes('rooms') || listing.includes('bedroom')) included++;
  }
  if (data.highlights?.length) {
    total++;
    if (data.highlights.some(h => listing.toLowerCase().includes(h.toLowerCase()))) included++;
  }
  if (data.uniqueDetail) {
    total++;
    if (listing.toLowerCase().includes(data.uniqueDetail.toLowerCase())) included++;
  }
  
  return {
    passed: included >= total * 0.8,
    details: `Factual accuracy: ${included}/${total} key facts incorporated`
  };
}

function checkQuestionsCoverage(data, listing) {
  if (!data.questions?.length) return { passed: true, details: 'No questions to validate' };
  
  const covered = data.questions.filter(question => {
    const questionWords = question.toLowerCase().split(' ').filter(word => word.length > 3);
    return questionWords.some(word => listing.toLowerCase().includes(word));
  });
  
  return {
    passed: covered.length >= data.questions.length * 0.7,
    details: `Question coverage: ${covered.length}/${data.questions.length} questions addressed`
  };
}

function checkReadability(listing) {
  const paragraphs = listing.split('\n\n').filter(p => p.trim());
  const sentences = listing.split(/[.!?]+/).filter(s => s.trim());
  const avgSentenceLength = listing.split(' ').length / sentences.length;
  
  return {
    passed: paragraphs.length >= 3 && paragraphs.length <= 8 && avgSentenceLength <= 25,
    details: `Readability: ${paragraphs.length} paragraphs, avg ${Math.round(avgSentenceLength)} words/sentence`
  };
}

function checkCompliance(listing) {
  const issues = [];
  if (listing.toLowerCase().includes('guaranteed')) issues.push('overclaim detected');
  if (/\bbest\b/i.test(listing)) issues.push('superlative claim');
  if (listing.toLowerCase().includes('investment opportunity') && !listing.includes('rental')) issues.push('investment claims');
  
  return {
    passed: issues.length === 0,
    details: issues.length ? `Compliance issues: ${issues.join(', ')}` : 'No compliance issues detected'
  };
}

function checkCallToAction(data, listing) {
  const saleKeywords = ['viewing', 'schedule', 'contact', 'call', 'visit', 'interested'];
  const rentKeywords = ['apply', 'documents', 'interested', 'submit', 'available', 'contact'];
  
  const keywords = data.transaction === 'sale' ? saleKeywords : rentKeywords;
  const hasCTA = keywords.some(keyword => listing.toLowerCase().includes(keyword));
  
  return {
    passed: hasCTA,
    details: hasCTA ? 'Appropriate call-to-action included' : 'Missing clear call-to-action'
  };
}

module.exports = router;
const PROPERTY_HIGHLIGHTS = {
  apartment: [
    'city center location',
    'modern kitchen',
    'balcony',
    'elevator',
    'parking space',
    'storage room',
    'energy efficient',
    'recently renovated',
    'good public transport',
    'shopping nearby',
    'quiet neighborhood',
    'great view'
  ],
  house: [
    'private garden',
    'garage',
    'multiple floors',
    'fireplace',
    'modern kitchen',
    'spacious living room',
    'master bedroom',
    'family bathroom',
    'storage space',
    'good neighborhood',
    'near schools',
    'parking space'
  ],
  studio: [
    'central location',
    'modern appliances',
    'efficient layout',
    'good natural light',
    'close to transport',
    'low maintenance',
    'affordable utilities',
    'near amenities',
    'perfect for starter',
    'investment potential',
    'quiet building',
    'security entrance'
  ],
  villa: [
    'luxury finishes',
    'private pool',
    'large garden',
    'multiple garages',
    'high ceilings',
    'premium location',
    'security system',
    'guest rooms',
    'entertainment area',
    'panoramic views',
    'wine cellar',
    'home office'
  ]
};

const TRANSLATIONS = {
  en: {
    step1: "Welcome to WoningTovenaar! I'll help you create a compelling property listing step by step.\n\nFirst, let me know: Are you looking to **sale** or **rent** this property?",
    
    step2: "Perfect! Now, what type of property are we working with?\n\nFor example: apartment, house, studio, villa, townhouse, etc.",
    
    step3: "Great choice! Now please provide the basic features and details of your property.\n\nInclude things like:\n• Size (m²)\n• Number of rooms/bedrooms\n• Year built\n• Special features (balcony, garden, parking, etc.)\n• Energy label\n• Any other important details",
    
    step4: "Excellent! Based on your property type, here are some highlights that might apply. Please select the ones that best describe your property and add any unique detail:",
    
    step5: "Perfect! Now, who is your target audience?\n\nFor example:\n• First-time buyer\n• Young professional\n• Family with children\n• Investor\n• Senior citizen\n• Expat\n• Student\n\nBe as specific as possible - this helps me tailor the message perfectly!",
    
    step6a: "Fantastic! Here's the detailed buyer persona I've created based on your target audience. This will guide how we craft your listing:",
    
    step6b: "Excellent! Based on your target audience, here are the top 10 questions they typically have when looking at properties like yours:",
    
    step6c: "Perfect! Here are compelling answers to those questions, specifically crafted for your property:",
    
    step7: "Outstanding! We now have everything needed to create your professional property listing.\n\nWhen you're ready, click the button below to generate your final listing text:",
    
    step7_ready: "You're all set! Your listing will incorporate:\n• Your property details\n• Selected highlights\n• Target audience insights\n• Persona-driven messaging\n• Answers to key buyer questions\n\nClick 'Generate Final Property Listing' when ready!",
    
    step8: "Here is your professionally crafted property listing! 🎉\n\nThis listing includes all your specific details and is designed to attract your target audience effectively."
  }
};

const SYSTEM_PROMPTS = {
  PERSONA_GENERATOR: `You are a real estate marketing expert. Create a detailed buyer persona in JSON format based on the provided property and target audience information.

Include these fields:
- demographics (age, income, lifestyle)
- motivations (why they're looking to buy/rent)
- pain_points (concerns and challenges)
- decision_factors (what influences their choice)
- communication_style (how they prefer to receive information)
- timeline (urgency level)

Make the persona specific and actionable for property marketing. Return only valid JSON.`,

  QUESTIONS_GENERATOR: `You are a real estate expert. Generate exactly 10 questions that the target audience typically asks when considering this type of property.

Focus on:
- Practical concerns (location, transport, costs)
- Lifestyle fit (space, noise, amenities)  
- Investment aspects (if relevant)
- Move-in process and timeline
- Neighborhood and local facilities

Return as a JSON array of exactly 10 question strings.`,

  ANSWERS_GENERATOR: `You are a skilled real estate copywriter. Create compelling answers to the provided questions using the property data.

Guidelines:
- Use the actual property details in answers
- Be specific and factual
- Address concerns proactively
- Include calls to action where appropriate
- Match the tone to the target audience
- Keep answers concise but comprehensive

Return as a JSON array of answer strings in the same order as the questions.`,

  LISTING_GENERATOR: `You are an expert real estate copywriter creating a compelling property listing.

Use ALL provided data including:
- Transaction type (sale/rent)
- Property type and features
- Selected highlights
- Unique details
- Target audience insights
- Generated persona
- Q&A content

Structure the listing with:
1. Compelling headline
2. Property overview
3. Key features (use selected highlights)
4. Unique selling points
5. Lifestyle benefits (persona-driven)
6. Practical information
7. Strong call to action

Write in a professional, engaging tone that speaks directly to the target audience. Include all factual details provided. Make it scannable with bullet points and short paragraphs.

Return only the final listing text, no JSON formatting.`
};

module.exports = {
  PROPERTY_HIGHLIGHTS,
  TRANSLATIONS,
  SYSTEM_PROMPTS
};
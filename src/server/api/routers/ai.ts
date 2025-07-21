import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { geminiClient } from "~/services/models/geminiClient";
import { patternRecognition } from "~/services/memory/patternRecognition";
import { contextualReasoning } from "~/services/memory/contextualReasoning";
import { communicationStyleAdapter } from "~/services/memory/communicationStyleAdapter";
import { userPreferenceLearning } from "~/services/memory/userPreferenceLearning";
import { workflowContinuation } from "~/services/memory/workflowContinuation";
import type { 
  Message, 
  ActionLog, 
  ContextualReasoning 
} from "~/types/conversation";

const messageSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.date(),
  isImage: z.boolean().optional(),
  intent: z.enum(['text', 'image', 'image_prompt', 'clarify', 'contextual_reasoning']).optional(),
  confidence: z.number().optional(),
  modelUsed: z.string().optional(),
  processingTime: z.number().optional(),
});

export const aiRouter = createTRPCRouter({
  processMessage: publicProcedure
    .input(z.object({
      content: z.string(),
      sessionId: z.string(),
      conversationHistory: z.array(messageSchema).optional(),
      userMemoryFingerprint: z.string().optional()
    }))
    .mutation(async ({ input }) => {
      const startTime = Date.now();
      const conversationHistory = input.conversationHistory ?? [];
      
      try {
        // Step 1: Load existing patterns for this session
        const existingPatterns = await patternRecognition.loadPatterns(input.sessionId);
        
        // Step 2: Classify intent with context (using optimized operation)
        const intentClassification = await geminiClient.classifyIntent(
          input.content, 
          conversationHistory
        );
        
        // Step 3: Analyze patterns in conversation
        const updatedPatterns = conversationHistory.length > 0 
          ? await patternRecognition.analyzeConversation(conversationHistory)
          : existingPatterns;
        
        // Step 4: Generate memory insights
        const memoryInsights = await patternRecognition.generateMemoryInsights(
          updatedPatterns, 
          conversationHistory.slice(-5)
        );
        
        // Step 5: Detect and adapt to communication style
        const communicationStyle = await communicationStyleAdapter.detectCommunicationStyle(conversationHistory);
        
        // Step 6: Learn user preferences
        const existingProfile = await userPreferenceLearning.loadPreferenceProfile(input.sessionId);
        const preferenceLearning = await userPreferenceLearning.analyzeUserPreferences(
          conversationHistory,
          existingProfile ?? undefined
        );
        
        // Step 7: Generate adaptive strategy based on preferences
        const allPreferences = [
          ...(existingProfile?.preferences ?? []),
          ...preferenceLearning.newPreferences,
          ...preferenceLearning.reinforcedPreferences
        ];
        const adaptiveStrategy = userPreferenceLearning.generateAdaptiveStrategy(allPreferences);
        
        // Step 8: Determine response strategy
        let responseContent: string;
        let reasoning: ContextualReasoning | undefined;
        let actionType = intentClassification.intent;
        let optimizationData: {
          strategy: string;
          tokensSaved: number;
          estimatedCost: number;
          reasoning: string;
        } | undefined = undefined;
        
        if (intentClassification.intent === 'image') {
          // Generate an image prompt instead of placeholder
          const imagePrompt = await generateImagePrompt(input.content, conversationHistory);
          responseContent = imagePrompt;
          actionType = 'image_prompt';
        } else if (intentClassification.intent === 'contextual_reasoning' || updatedPatterns.length > 0) {
          // Use contextual reasoning for complex requests or when patterns exist
          const reasoningResult = await contextualReasoning.executeContextualReasoning(
            input.content,
            conversationHistory,
            updatedPatterns
          );
          
          responseContent = reasoningResult.response;
          reasoning = reasoningResult.reasoning;
          actionType = reasoningResult.actionType;
        } else if (intentClassification.intent === 'clarify') {
          // Generate clarification request
          responseContent = await generateClarificationRequest(input.content, conversationHistory);
        } else {
          // Generate preference-aware and style-adapted text response
          const styleAdaptation = await communicationStyleAdapter.adaptResponseStyle(
            input.content,
            communicationStyle,
            input.content
          );
          
          // Enhance prompt with user preferences and adaptive strategy
          const enhancedPrompt = `${styleAdaptation.adaptedPrompt}

User Preference Context:
- Response Style: ${adaptiveStrategy.responseStyle}
- Content Focus: ${adaptiveStrategy.contentFocus.join(', ')}
- Communication Approach: ${adaptiveStrategy.communicationApproach}
- Learned Preferences: ${preferenceLearning.newPreferences.length} new, ${preferenceLearning.reinforcedPreferences.length} reinforced

Adapt your response to match these learned preferences while maintaining helpfulness.`;
          
          const response = await geminiClient.generateText(
            enhancedPrompt,
            conversationHistory,
            { model: 'gemini-2.5-flash' },
            'response_generation'
          );
          responseContent = response.content;
          
          // Store optimization data for later inclusion in action log
          optimizationData = response.optimization;
        }
        
        const processingTime = Date.now() - startTime;
        
        // Step 9: Save updated user preference profile
        if (preferenceLearning.newPreferences.length > 0 || preferenceLearning.reinforcedPreferences.length > 0) {
          const updatedProfile = {
            sessionId: input.sessionId,
            preferences: allPreferences.filter(p => p.strength > 0.2), // Only keep meaningful preferences
            learningHistory: [
              ...(existingProfile?.learningHistory ?? []).slice(-20), // Keep last 20 events
              ...preferenceLearning.newPreferences.map(pref => ({
                timestamp: new Date(),
                event: 'discovered' as const,
                preference: pref,
                trigger: input.content.slice(0, 100)
              })),
              ...preferenceLearning.reinforcedPreferences.map(pref => ({
                timestamp: new Date(),
                event: 'reinforced' as const,
                preference: pref,
                trigger: input.content.slice(0, 100)
              }))
            ],
            adaptationStrategy: adaptiveStrategy,
            lastUpdated: new Date()
          };
          
          await userPreferenceLearning.savePreferenceProfile(updatedProfile);
        }
        
        // Step 10: Determine model used
        const modelUsed = actionType === 'image_prompt' ? 'gemini-prompt-generator' : actionType === 'image' ? 'placeholder-generator' : 'gemini-2.5-flash';
        
        // Step 11: Create response message
        const responseMessage: Message = {
          id: `ai_${Date.now()}`,
          type: "assistant",
          content: responseContent,
          timestamp: new Date(),
          isImage: actionType === 'image' || actionType === 'image_prompt',
          intent: actionType,
          confidence: intentClassification.confidence,
          modelUsed,
          processingTime
        };
        
        // Step 12: Create detailed action log
        const actionLog: ActionLog = {
          timestamp: new Date(),
          action: actionType,
          input: input.content,
          output: responseContent,
          modelUsed,
          confidence: intentClassification.confidence,
          processingTime,
          contextualReasoning: reasoning,
          memoryInsights,
          conversationPatterns: updatedPatterns,
          reasoningChain: [
            `1. Loaded ${existingPatterns.length} conversation patterns`,
            `2. Classified intent as "${intentClassification.intent}" (${Math.round(intentClassification.confidence * 100)}% confidence)`,
            `3. ${intentClassification.reasoning}`,
            `4. Analyzed conversation and found ${updatedPatterns.length} patterns`,
            `5. Generated memory insights: ${memoryInsights.communicationStyle} style, ${memoryInsights.topicInterests.length} interests`,
            `6. Detected communication style: ${communicationStyle.name} (${Math.round(communicationStyle.confidence * 100)}% confidence)`,
            `7. Learned user preferences: ${preferenceLearning.newPreferences.length} new, ${preferenceLearning.reinforcedPreferences.length} reinforced`,
            `8. Adaptive strategy: ${adaptiveStrategy.responseStyle} style, ${adaptiveStrategy.communicationApproach} approach`,
            `9. Applied ${actionType === 'contextual_reasoning' ? 'contextual reasoning' : 'preference-aware response generation'}`,
            `10. Used model: ${modelUsed}`,
            `11. Generated response in ${processingTime}ms`
          ]
        };
        
        // Add optimization data if available
        if (typeof optimizationData !== 'undefined') {
          actionLog.optimization = optimizationData;
        };
        
        // Step 13: Generate workflow continuation suggestions
        const workflowSuggestions = await workflowContinuation.generateContinuationSuggestions(
          conversationHistory,
          updatedPatterns,
          memoryInsights
        );
        
        // Step 14: Save updated patterns
        await patternRecognition.savePatterns(input.sessionId, updatedPatterns);
        
        return {
          message: responseMessage,
          actionLog,
          memoryInsights,
          patterns: updatedPatterns.slice(0, 5), // Return top 5 patterns for UI
          predictiveInsights: reasoning?.hypotheticalNext ?? [],
          workflowSuggestions: workflowSuggestions.suggestions.slice(0, 3), // Return top 3 suggestions
          conversationState: workflowSuggestions.conversationState,
          nextBestActions: workflowSuggestions.nextBestActions
        };
        
      } catch (error) {
        console.error('AI processing error:', error);
        
        // Fallback response
        const processingTime = Date.now() - startTime;
        const fallbackMessage: Message = {
          id: `ai_${Date.now()}`,
          type: "assistant",
          content: "I apologize, but I encountered an error processing your request. Could you please try rephrasing your message?",
          timestamp: new Date(),
          intent: 'text',
          confidence: 0.3,
          modelUsed: 'fallback',
          processingTime
        };
        
        return {
          message: fallbackMessage,
          actionLog: null,
          memoryInsights: null,
          patterns: [],
          predictiveInsights: [],
          workflowSuggestions: [],
          conversationState: 'beginning',
          nextBestActions: []
        };
      }
    }),

  getMemoryInsights: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const patterns = await patternRecognition.loadPatterns(input.sessionId);
        const insights = await patternRecognition.generateMemoryInsights(patterns, []);
        
        return {
          patterns: patterns.slice(0, 10), // Return top 10 patterns
          insights,
          patternCount: patterns.length
        };
      } catch (error) {
        console.error('Memory insights error:', error);
        return {
          patterns: [],
          insights: null,
          patternCount: 0
        };
      }
    }),
    
  getConversationPatterns: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const patterns = await patternRecognition.loadPatterns(input.sessionId);
        return patterns;
      } catch (error) {
        console.error('Pattern loading error:', error);
        return [];
      }
    }),
    
  getPredictiveInsights: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const patterns = await patternRecognition.loadPatterns(input.sessionId);
        const insights = await contextualReasoning.generatePredictiveInsights(patterns);
        return insights;
      } catch (error) {
        console.error('Predictive insights error:', error);
        return ['Continue the conversation with any topic you\'d like'];
      }
    }),
    
  updateUserFeedback: publicProcedure
    .input(z.object({
      messageId: z.string(),
      helpful: z.boolean(),
      feedbackType: z.enum(['response_quality', 'prediction_accuracy', 'style_preference'])
    }))
    .mutation(async ({ input }) => {
      // For now, just log the feedback
      // In a full implementation, this would update pattern confidence scores
      console.log('User feedback received:', input);
      
      return {
        success: true,
        message: 'Feedback recorded successfully'
      };
    }),
    
  getUserPreferences: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      try {
        const profile = await userPreferenceLearning.loadPreferenceProfile(input.sessionId);
        return {
          profile,
          hasPreferences: !!profile && profile.preferences.length > 0
        };
      } catch (error) {
        console.error('Error loading user preferences:', error);
        return {
          profile: null,
          hasPreferences: false
        };
      }
    })
});

// Helper function for generating image prompts
async function generateImagePrompt(
  input: string,
  conversationHistory: Message[]
): Promise<string> {
  const recentContext = conversationHistory.slice(-3)
    .map(m => `${m.type}: ${m.content.slice(0, 150)}`)
    .join('\n');

  const promptGenerationPrompt = `
The user wants to generate an image with this request: "${input}"

Recent conversation context:
${recentContext}

Generate a detailed, creative image prompt that would be suitable for an AI image generator like DALL-E or Midjourney. 

The prompt should be:
- Descriptive and specific
- Include artistic style, mood, lighting, composition details
- Be suitable for generating a high-quality image
- Take into account the conversation context if relevant

Format your response as:
**Image Prompt:**
[Your detailed image generation prompt here]

**Style:** [Brief description of the artistic style/approach]

**Notes:** [Any additional context about why you chose this prompt]`;

  try {
    const response = await geminiClient.generateText(promptGenerationPrompt, [], {
      model: 'gemini-2.5-flash',
      temperature: 0.8 // Higher creativity for image prompts
    });
    
    return response.content;
  } catch {
    return `**Image Prompt:**
${input}

**Style:** Photorealistic, high quality, detailed

**Notes:** Generated a basic prompt based on your request: "${input}"`;
  }
}

// Helper function for generating clarification requests
async function generateClarificationRequest(
  input: string, 
  conversationHistory: Message[]
): Promise<string> {
  const recentContext = conversationHistory.slice(-2)
    .map(m => `${m.type}: ${m.content}`)
    .join('\n');

  const clarificationPrompt = `
The user said: "${input}"

Recent conversation context:
${recentContext}

This input seems ambiguous or needs clarification. Generate a helpful clarification question that:
1. References relevant context from the conversation
2. Offers specific options when possible
3. Is friendly and encouraging

Generate only the clarification question, no explanation:`;

  try {
    const response = await geminiClient.generateText(clarificationPrompt, [], {
      model: 'gemini-2.5-flash-lite-preview-06-17',
      temperature: 0.6
    });
    
    return response.content;
  } catch {
    return `Could you provide more details about "${input}"? I'd like to help you in the best way possible.`;
  }
}
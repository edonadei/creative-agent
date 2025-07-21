import type { 
  Message, 
  ConversationPattern, 
  ContextualReasoning
} from '~/types/conversation';
import { geminiClient } from '../models/geminiClient';

export interface ContextualReasoningResult {
  response: string;
  reasoning: ContextualReasoning;
  actionType: 'text' | 'image' | 'image_prompt' | 'clarify' | 'contextual_reasoning';
  confidence: number;
  processingSteps: string[];
}

export class ContextualReasoningEngine {
  async reasonAboutIntent(
    input: string,
    conversationHistory: Message[],
    patterns: ConversationPattern[]
  ): Promise<ContextualReasoning> {
    try {
      const reasoningPrompt = this.buildReasoningPrompt(input, conversationHistory, patterns);
      const response = await geminiClient.generateText(reasoningPrompt, [], {
        model: 'gemini-2.5-flash',
        temperature: 0.4,
      });

      return this.parseReasoningResponse(response.content, patterns);
    } catch (error) {
      console.error('Contextual reasoning error:', error);
      return this.fallbackReasoning(input, conversationHistory, patterns);
    }
  }

  async generatePredictiveInsights(patterns: ConversationPattern[]): Promise<string[]> {
    if (patterns.length === 0) {
      return ['Continue the conversation with any topic you\'d like to explore'];
    }

    try {
      const predictionPrompt = this.buildPredictionPrompt(patterns);
      const response = await geminiClient.generateText(predictionPrompt, [], {
        model: 'gemini-2.5-flash-lite-preview-06-17',
        temperature: 0.6,
      });

      return this.parsePredictionResponse(response.content);
    } catch (error) {
      console.error('Prediction generation error:', error);
      return this.fallbackPredictions(patterns);
    }
  }

  async executeContextualReasoning(
    input: string,
    conversationHistory: Message[],
    patterns: ConversationPattern[]
  ): Promise<ContextualReasoningResult> {
    const processingSteps: string[] = [];

    try {
      // Step 1: Analyze conversation context
      processingSteps.push('Analyzing conversation context');
      const contextAnalysis = await this.analyzeConversationContext(conversationHistory);
      
      // Step 2: Apply pattern recognition
      processingSteps.push(`Applied ${patterns.length} conversation patterns`);
      const relevantPatterns = this.identifyRelevantPatterns(input, patterns);
      
      // Step 3: Generate hypothetical intents
      processingSteps.push('Generating hypothetical user intents');
      const hypotheticalIntents = await this.generateHypotheticalIntents(
        input, 
        contextAnalysis, 
        relevantPatterns
      );
      
      // Step 4: Reason about user needs
      processingSteps.push('Predicting user needs based on patterns');
      const predictedNeeds = await this.predictUserNeeds(hypotheticalIntents, conversationHistory);
      
      // Step 5: Generate contextually-aware response
      processingSteps.push('Generating contextually-aware response');
      const { response, actionType } = await this.generateContextualResponse(
        input,
        predictedNeeds,
        relevantPatterns,
        conversationHistory
      );

      const reasoning: ContextualReasoning = {
        userIntent: hypotheticalIntents[0] ?? input,
        confidence: this.calculateContextualConfidence(relevantPatterns, contextAnalysis),
        reasoning: this.buildReasoningExplanation(relevantPatterns, predictedNeeds),
        basedOn: relevantPatterns,
        hypotheticalNext: predictedNeeds,
        conversationFlow: this.determineConversationFlow(conversationHistory, input),
      };

      return {
        response,
        reasoning,
        actionType,
        confidence: reasoning.confidence,
        processingSteps,
      };
    } catch (error) {
      console.error('Contextual reasoning execution error:', error);
      processingSteps.push('Fallback to basic reasoning');
      
      return {
        response: await this.generateFallbackResponse(input),
        reasoning: this.fallbackReasoning(input, conversationHistory, patterns),
        actionType: 'text',
        confidence: 0.5,
        processingSteps,
      };
    }
  }

  private buildReasoningPrompt(
    input: string,
    conversationHistory: Message[],
    patterns: ConversationPattern[]
  ): string {
    const historyContext = conversationHistory.slice(-5)
      .map(m => `${m.type}: ${m.content}`)
      .join('\n');

    const patternContext = patterns.length > 0 
      ? patterns.map(p => `${p.type}: ${p.pattern} (confidence: ${p.confidence})`).join('\n')
      : 'No patterns detected yet';

    return `
Analyze the user's intent based on conversation history and detected patterns:

Current user input: "${input}"

Recent conversation:
${historyContext}

User patterns:
${patternContext}

Provide contextual reasoning in JSON format:
{
  "userIntent": "inferred intent description",
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how you reached this conclusion",
  "hypotheticalNext": ["prediction1", "prediction2", "prediction3"],
  "conversationFlow": "continuation|topic_shift|clarification_needed"
}

Focus on understanding what the user really wants based on their patterns and conversation flow.`;
  }

  private buildPredictionPrompt(patterns: ConversationPattern[]): string {
    const patternSummary = patterns
      .map(p => `${p.type}: ${p.pattern}`)
      .join('\n');

    return `
Based on these user patterns, predict what they might want to do next:

Patterns:
${patternSummary}

Generate 3-5 helpful predictions as a JSON array:
["prediction 1", "prediction 2", "prediction 3"]

Make predictions specific and actionable based on the user's established patterns.`;
  }

  private async analyzeConversationContext(conversationHistory: Message[]): Promise<{
    topic: string;
    sentiment: string;
    complexity: number;
    recentFlow: string;
  }> {
    if (conversationHistory.length === 0) {
      return {
        topic: 'new conversation',
        sentiment: 'neutral',
        complexity: 0.5,
        recentFlow: 'starting',
      };
    }

    // Simple context analysis - in production, this could be more sophisticated
    const recentMessages = conversationHistory.slice(-3);
    const lastUserMessage = recentMessages.reverse().find((m: Message) => m.type === 'user');
    
    return {
      topic: lastUserMessage?.content.split(' ').slice(0, 3).join(' ') ?? 'general',
      sentiment: 'neutral', // Could be analyzed with sentiment analysis
      complexity: recentMessages.length > 2 ? 0.7 : 0.4,
      recentFlow: recentMessages.length > 1 ? 'ongoing' : 'starting',
    };
  }

  private identifyRelevantPatterns(input: string, patterns: ConversationPattern[]): ConversationPattern[] {
    const inputLower = input.toLowerCase();
    
    return patterns.filter(pattern => {
      const patternKeywords = pattern.pattern.toLowerCase().split(' ');
      return patternKeywords.some(keyword => inputLower.includes(keyword)) ||
             pattern.type === 'communication_style'; // Always include communication style
    });
  }

  private async generateHypotheticalIntents(
    input: string,
    _contextAnalysis: { topic: string; sentiment: string; complexity: number; recentFlow: string },
    relevantPatterns: ConversationPattern[]
  ): Promise<string[]> {
    // Generate 2-3 hypothetical intents based on input and context
    const intents = [input]; // Start with literal intent
    
    // Add pattern-based intents
    for (const pattern of relevantPatterns) {
      if (pattern.type === 'intent_sequence') {
        intents.push(`Continue ${pattern.pattern} workflow`);
      } else if (pattern.type === 'preference') {
        intents.push(`Apply ${pattern.pattern} preference`);
      }
    }

    return intents.slice(0, 3); // Return top 3 intents
  }

  private async predictUserNeeds(
    _hypotheticalIntents: string[],
    conversationHistory: Message[]
  ): Promise<string[]> {
    // Simple prediction based on intents and history
    const predictions: string[] = [];
    
    // Analyze recent conversation for continuation opportunities
    const lastAssistantMessage = conversationHistory.slice().reverse().find((m: Message) => m.type === 'assistant');
    if (lastAssistantMessage?.isImage) {
      predictions.push('Generate variations or modifications of the image');
      predictions.push('Create related visual content');
    }

    // Add generic helpful predictions
    predictions.push('Ask follow-up questions for clarification');
    predictions.push('Request additional details or examples');

    return predictions.slice(0, 3);
  }

  private async generateContextualResponse(
    input: string,
    predictedNeeds: string[],
    relevantPatterns: ConversationPattern[],
    conversationHistory: Message[]
  ): Promise<{ response: string; actionType: 'text' | 'image' | 'image_prompt' | 'clarify' | 'contextual_reasoning' }> {
    // Determine action type based on input and patterns
    const actionType = this.determineActionType(input, relevantPatterns);
    
    if (actionType === 'image') {
      return {
        response: '**Image Prompt:**\nA beautiful, high-quality image based on your request\n\n**Style:** Photorealistic, detailed\n\n**Notes:** This is a contextual reasoning fallback - the main AI should generate a more specific prompt.',
        actionType: 'image',
      };
    }

    // Generate contextual text response
    const contextPrompt = this.buildContextualResponsePrompt(
      input,
      predictedNeeds,
      relevantPatterns,
      conversationHistory
    );

    try {
      const response = await geminiClient.generateText(contextPrompt, [], {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
      });

      return {
        response: response.content,
        actionType,
      };
    } catch (error) {
      console.error('Contextual response generation error:', error);
      return {
        response: await this.generateFallbackResponse(input),
        actionType: 'text',
      };
    }
  }

  private buildContextualResponsePrompt(
    input: string,
    predictedNeeds: string[],
    relevantPatterns: ConversationPattern[],
    conversationHistory: Message[]
  ): string {
    const styleGuidance = relevantPatterns
      .filter(p => p.type === 'communication_style' || p.type === 'preference')
      .map(p => p.pattern)
      .join(', ');

    const recentContext = conversationHistory.slice(-3)
      .map(m => `${m.type}: ${m.content}`)
      .join('\n');

    return `
Generate a helpful response to the user's input, taking into account their patterns and conversation context.

User input: "${input}"

User's communication style/preferences: ${styleGuidance || 'No specific style detected'}

Recent conversation context:
${recentContext}

Predicted user needs: ${predictedNeeds.join(', ')}

Guidelines:
- Adapt your response to match the user's communication style
- Reference relevant conversation context when helpful
- Be proactive in offering assistance based on predicted needs
- Keep response natural and conversational
- Don't explicitly mention the patterns you're using

Generate a helpful, contextually-aware response:`;
  }

  private determineActionType(
    input: string, 
    relevantPatterns: ConversationPattern[]
  ): 'text' | 'image' | 'image_prompt' | 'clarify' | 'contextual_reasoning' {
    const inputLower = input.toLowerCase();
    
    // Check for explicit image requests
    if (inputLower.includes('image') || inputLower.includes('generate') || 
        inputLower.includes('create') || inputLower.includes('draw') ||
        inputLower.includes('design') || inputLower.includes('visualize')) {
      return 'image';
    }

    // Check for ambiguous input
    if (input.trim().length < 10 || inputLower.includes('what') || inputLower.includes('how')) {
      return 'clarify';
    }

    // If we have relevant patterns, use contextual reasoning
    if (relevantPatterns.length > 0) {
      return 'contextual_reasoning';
    }

    return 'text';
  }

  private determineConversationFlow(
    conversationHistory: Message[],
    input: string
  ): 'continuation' | 'topic_shift' | 'clarification_needed' {
    if (conversationHistory.length === 0) {
      return 'clarification_needed';
    }

    const lastMessage = conversationHistory[conversationHistory.length - 1];
    if (lastMessage && this.isTopicRelated(lastMessage.content, input)) {
      return 'continuation';
    }

    return 'topic_shift';
  }

  private isTopicRelated(previousContent: string, currentInput: string): boolean {
    // Simple topic relatedness check
    const prevWords = previousContent.toLowerCase().split(' ');
    const currWords = currentInput.toLowerCase().split(' ');
    
    const overlap = prevWords.filter(word => currWords.includes(word) && word.length > 3);
    return overlap.length > 0;
  }

  private calculateContextualConfidence(
    relevantPatterns: ConversationPattern[],
    contextAnalysis: { topic: string; sentiment: string; complexity: number; recentFlow: string }
  ): number {
    if (relevantPatterns.length === 0) return 0.4;
    
    const avgPatternConfidence = relevantPatterns.reduce((sum, p) => sum + p.confidence, 0) / relevantPatterns.length;
    const contextFactor = contextAnalysis.complexity > 0.5 ? 0.1 : -0.1;
    
    return Math.min(Math.max(avgPatternConfidence + contextFactor, 0.2), 0.95);
  }

  private buildReasoningExplanation(
    relevantPatterns: ConversationPattern[],
    predictedNeeds: string[]
  ): string {
    if (relevantPatterns.length === 0) {
      return 'No established patterns yet, using general conversation approach';
    }

    const patternTypes = relevantPatterns.map(p => p.type).join(', ');
    return `Based on ${relevantPatterns.length} detected patterns (${patternTypes}), predicting user may need: ${predictedNeeds.join(', ')}`;
  }

  private parseReasoningResponse(content: string, patterns: ConversationPattern[]): ContextualReasoning {
    try {
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = jsonRegex.exec(content);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]) as {
        userIntent?: string;
        confidence?: number;
        reasoning?: string;
        hypotheticalNext?: string[];
        conversationFlow?: string;
      };
      
      return {
        userIntent: parsed.userIntent ?? 'General conversation',
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning ?? 'Basic analysis',
        basedOn: patterns,
        hypotheticalNext: parsed.hypotheticalNext ?? [],
        conversationFlow: (parsed.conversationFlow as 'continuation' | 'topic_shift' | 'clarification_needed') ?? 'continuation',
      };
    } catch {
      return this.fallbackReasoning('', [], patterns);
    }
  }

  private parsePredictionResponse(content: string): string[] {
    try {
      const jsonRegex = /\[[\s\S]*\]/;
      const jsonMatch = jsonRegex.exec(content);
      if (!jsonMatch) throw new Error('No JSON array found');

      return JSON.parse(jsonMatch[0]) as string[];
    } catch {
      return ['Continue the conversation', 'Ask questions', 'Explore new topics'];
    }
  }

  private fallbackReasoning(
    input: string,
    conversationHistory: Message[],
    patterns: ConversationPattern[]
  ): ContextualReasoning {
    return {
      userIntent: input || 'General conversation',
      confidence: 0.4,
      reasoning: 'Fallback reasoning due to analysis error',
      basedOn: patterns,
      hypotheticalNext: ['Continue conversation', 'Provide assistance'],
      conversationFlow: conversationHistory.length > 0 ? 'continuation' : 'clarification_needed',
    };
  }

  private fallbackPredictions(patterns: ConversationPattern[]): string[] {
    if (patterns.some(p => p.pattern.includes('image'))) {
      return ['Generate more images', 'Modify existing images', 'Explore visual concepts'];
    }
    
    return ['Continue the conversation', 'Ask follow-up questions', 'Explore related topics'];
  }

  private async generateFallbackResponse(input: string): Promise<string> {
    return `I understand you're asking about "${input}". Let me help you with that.`;
  }
}

// Singleton instance
export const contextualReasoning = new ContextualReasoningEngine();
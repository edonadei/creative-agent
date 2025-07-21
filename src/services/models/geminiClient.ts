import { GoogleGenAI } from '@google/genai';
import { env } from '~/env';
import { tokenOptimizer } from '../optimization/tokenOptimizer';
import type { Message } from '~/types/conversation';

export interface GeminiConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite-preview-06-17';
  temperature?: number;
  maxTokens?: number;
  thinkingBudget?: number;
}

export interface GeminiResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  finishReason?: string;
  optimization?: {
    strategy: string;
    tokensSaved: number;
    estimatedCost: number;
    reasoning: string;
  };
}

export class GeminiClient {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
    });
  }

  async generateText(
    input: string,
    conversationHistory: Message[] = [],
    config: GeminiConfig = { model: 'gemini-2.5-flash' },
    operation: 'intent_classification' | 'pattern_analysis' | 'response_generation' = 'response_generation'
  ): Promise<GeminiResponse> {
    try {
      // Step 1: Optimize conversation history
      const historyOptimization = tokenOptimizer.optimizeConversationHistory(conversationHistory);
      
      // Step 2: Create optimized prompt
      const promptOptimization = tokenOptimizer.createOptimizedPrompt(operation, {
        input,
        conversationHistory: historyOptimization.optimizedMessages,
        userStyle: this.detectUserStyle(conversationHistory)
      });
      
      // Step 3: Select optimal model
      const complexityScore = this.calculateComplexity(input, conversationHistory);
      const estimatedTokens = tokenOptimizer.estimateTokens([{ content: promptOptimization.content } as Message]);
      const modelSelection = tokenOptimizer.selectOptimalModel(operation, complexityScore, estimatedTokens);
      
      // Use optimized model selection
      const selectedModel = config.model || modelSelection.model;
      
      const contents = this.formatConversationHistory(historyOptimization.optimizedMessages, input);
      
      const geminiConfig = {
        thinkingConfig: {
          thinkingBudget: config.thinkingBudget ?? 0,
        },
        responseMimeType: 'text/plain',
        temperature: config.temperature ?? env.AI_TEMPERATURE,
        maxOutputTokens: config.maxTokens ?? env.AI_MAX_TOKENS,
      };

      const response = await this.ai.models.generateContent({
        model: selectedModel,
        config: geminiConfig,
        contents,
      });

      return {
        content: response.text ?? '',
        model: selectedModel,
        tokensUsed: response.usageMetadata?.totalTokenCount,
        finishReason: 'completed',
        optimization: {
          strategy: `${historyOptimization.strategy} + ${modelSelection.reasoning}`,
          tokensSaved: historyOptimization.tokensSaved,
          estimatedCost: modelSelection.estimatedCost,
          reasoning: `${promptOptimization.strategy}: ${Math.round(promptOptimization.compressionRatio * 100)}% compression`
        }
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private calculateComplexity(input: string, history: Message[]): number {
    // Simple complexity scoring based on input length, question marks, technical terms
    let score = 0;
    
    // Length factor
    score += Math.min(input.length / 500, 0.3);
    
    // Question complexity
    const questionMarks = (input.match(/\?/g) || []).length;
    score += Math.min(questionMarks * 0.1, 0.2);
    
    // Technical terms
    const techTerms = ['implement', 'algorithm', 'optimize', 'architecture', 'system'];
    const techScore = techTerms.filter(term => input.toLowerCase().includes(term)).length;
    score += Math.min(techScore * 0.15, 0.3);
    
    // History context
    score += Math.min(history.length * 0.05, 0.2);
    
    return Math.min(score, 1.0);
  }
  
  private detectUserStyle(history: Message[]): string {
    if (history.length < 3) return 'casual';
    
    const userMessages = history.filter(m => m.type === 'user');
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    
    if (avgLength > 100) return 'detailed';
    if (avgLength < 30) return 'brief';
    return 'casual';
  }

  async generateTextStream(
    input: string,
    conversationHistory: Message[] = [],
    config: GeminiConfig = { model: 'gemini-2.5-flash' }
  ): Promise<AsyncIterableIterator<string>> {
    try {
      const contents = this.formatConversationHistory(conversationHistory, input);
      
      const geminiConfig = {
        thinkingConfig: {
          thinkingBudget: config.thinkingBudget ?? 0,
        },
        responseMimeType: 'text/plain',
        temperature: config.temperature ?? env.AI_TEMPERATURE,
        maxOutputTokens: config.maxTokens ?? env.AI_MAX_TOKENS,
      };

      const response = await this.ai.models.generateContentStream({
        model: config.model,
        config: geminiConfig,
        contents,
      });

      return this.streamToAsyncIterator(response);
    } catch (error) {
      console.error('Gemini streaming API error:', error);
      throw new Error(`Failed to generate text stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatConversationHistory(history: Message[], currentInput: string) {
    const contents = [];

    // Add conversation history
    for (const message of history) {
      // Skip image messages for now (we'll handle these later)
      if (message.isImage) continue;

      contents.push({
        role: message.type === 'user' ? 'user' : 'model',
        parts: [{ text: message.content }],
      });
    }

    // Add current user input
    contents.push({
      role: 'user',
      parts: [{ text: currentInput }],
    });

    return contents;
  }

  private async* streamToAsyncIterator(
    response: AsyncIterable<{ text?: string }>
  ): AsyncIterableIterator<string> {
    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  async classifyIntent(
    input: string,
    conversationHistory: Message[] = []
  ): Promise<{
    intent: 'text' | 'image' | 'image_prompt' | 'clarify' | 'contextual_reasoning';
    confidence: number;
    reasoning: string;
  }> {
    const prompt = `
Analyze the user's input and conversation history to determine their intent. 

User input: "${input}"

Previous conversation context: ${conversationHistory.length > 0 
  ? conversationHistory.slice(-3).map(m => `${m.type}: ${m.content}`).join('\n') 
  : 'No previous context'}

Classify the intent as one of:
- "text": User wants text-based response, explanation, conversation
- "image": User explicitly wants image generation (contains words like "create image", "generate picture", "show me visually", "design", "visualize")
- "image_prompt": User wants an image prompt for use with external AI image generators
- "clarify": Input is ambiguous and needs clarification
- "contextual_reasoning": Complex request that requires understanding conversation patterns and context

Respond in JSON format:
{
  "intent": "...",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of classification"
}`;

    try {
      const response = await this.generateText(prompt, [], {
        model: 'gemini-2.5-flash',
        temperature: 0.3, // Lower temperature for more consistent classification
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        intent: result.intent || 'text',
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'Default classification',
      };
    } catch (error) {
      console.error('Intent classification error:', error);
      // Fallback to simple keyword-based classification
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes('image') || lowerInput.includes('picture') || 
          lowerInput.includes('generate') || lowerInput.includes('create') ||
          lowerInput.includes('design') || lowerInput.includes('visualize')) {
        return {
          intent: 'image',
          confidence: 0.7,
          reasoning: 'Keyword-based classification (fallback)',
        };
      }
      
      return {
        intent: 'text',
        confidence: 0.6,
        reasoning: 'Fallback classification',
      };
    }
  }
}

// Singleton instance
export const geminiClient = new GeminiClient();
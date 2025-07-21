import type { Message } from '~/types/conversation';

export interface OptimizedPrompt {
  content: string;
  originalLength: number;
  optimizedLength: number;
  compressionRatio: number;
  strategy: string;
}

export interface TokenUsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  optimizationSavings: number;
}

export class TokenOptimizer {
  private static readonly MAX_CONTEXT_MESSAGES = 5;
  private static readonly MAX_PATTERN_CONTEXT = 3;
  private static readonly COST_PER_1K_TOKENS = 0.00015; // Gemini Flash pricing
  
  /**
   * Optimize conversation history to reduce token usage while preserving context
   */
  optimizeConversationHistory(messages: Message[]): {
    optimizedMessages: Message[];
    strategy: string;
    tokensSaved: number;
  } {
    if (messages.length <= TokenOptimizer.MAX_CONTEXT_MESSAGES) {
      return {
        optimizedMessages: messages,
        strategy: 'no_optimization_needed',
        tokensSaved: 0
      };
    }

    // Strategy 1: Keep most recent messages + any with high importance
    const recentMessages = messages.slice(-TokenOptimizer.MAX_CONTEXT_MESSAGES);
    const importantMessages = messages.slice(0, -TokenOptimizer.MAX_CONTEXT_MESSAGES)
      .filter(m => this.isHighImportanceMessage(m));

    // Strategy 2: Summarize older messages if too many
    const optimizedMessages = [...importantMessages.slice(-2), ...recentMessages];
    
    const originalTokens = this.estimateTokensPrivate(messages);
    const optimizedTokens = this.estimateTokensPrivate(optimizedMessages);
    
    return {
      optimizedMessages,
      strategy: 'recent_plus_important',
      tokensSaved: originalTokens - optimizedTokens
    };
  }

  /**
   * Create efficient prompts for different AI operations
   */
  createOptimizedPrompt(
    operation: 'intent_classification' | 'pattern_analysis' | 'response_generation',
    context: {
      input: string;
      conversationHistory?: Message[];
      patterns?: string[];
      userStyle?: string;
    }
  ): OptimizedPrompt {
    let content: string;
    let strategy: string;

    switch (operation) {
      case 'intent_classification':
        content = this.createIntentClassificationPrompt(context.input, context.conversationHistory);
        strategy = 'minimal_context_classification';
        break;
        
      case 'pattern_analysis':
        content = this.createPatternAnalysisPrompt(context.conversationHistory || [], context.patterns);
        strategy = 'focused_pattern_detection';
        break;
        
      case 'response_generation':
        content = this.createResponseGenerationPrompt(
          context.input, 
          context.conversationHistory, 
          context.userStyle
        );
        strategy = 'contextual_response_optimization';
        break;
        
      default:
        content = context.input;
        strategy = 'no_optimization';
    }

    const originalLength = context.input.length + (context.conversationHistory?.join(' ').length || 0);
    const optimizedLength = content.length;

    return {
      content,
      originalLength,
      optimizedLength,
      compressionRatio: originalLength > 0 ? optimizedLength / originalLength : 1,
      strategy
    };
  }

  /**
   * Smart model selection based on complexity and cost
   */
  selectOptimalModel(
    operation: string,
    complexityScore: number,
    tokenCount: number
  ): {
    model: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite-preview-06-17';
    reasoning: string;
    estimatedCost: number;
  } {
    // Use Flash Lite for simple operations to save costs
    if (operation === 'intent_classification' && complexityScore < 0.5) {
      return {
        model: 'gemini-2.5-flash-lite-preview-06-17',
        reasoning: 'Simple intent classification - using cost-efficient Flash Lite',
        estimatedCost: this.calculateCost(tokenCount, 'lite')
      };
    }

    // Use Flash Lite for short responses
    if (tokenCount < 200 && complexityScore < 0.7) {
      return {
        model: 'gemini-2.5-flash-lite-preview-06-17',
        reasoning: 'Short context, moderate complexity - Flash Lite sufficient',
        estimatedCost: this.calculateCost(tokenCount, 'lite')
      };
    }

    // Use Flash for complex reasoning and long contexts
    return {
      model: 'gemini-2.5-flash',
      reasoning: 'Complex reasoning or long context - using full Flash model',
      estimatedCost: this.calculateCost(tokenCount, 'flash')
    };
  }

  /**
   * Estimate tokens for messages (public method)
   */
  estimateTokens(messages: Message[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Track and calculate token usage metrics
   */
  calculateUsageMetrics(
    inputTokens: number,
    outputTokens: number,
    originalInputTokens: number,
    model: string
  ): TokenUsageMetrics {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = this.calculateCost(totalTokens, model);
    const originalCost = this.calculateCost(originalInputTokens + outputTokens, model);
    
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      optimizationSavings: originalCost - estimatedCost
    };
  }

  private createIntentClassificationPrompt(input: string, history?: Message[]): string {
    const recentContext = history?.slice(-2).map(m => `${m.type}: ${m.content.slice(0, 100)}`).join('\n') || '';
    
    return `Classify intent for: "${input}"
${recentContext ? `Context: ${recentContext}` : ''}
Respond: {"intent":"text|image|clarify|contextual_reasoning","confidence":0.0-1.0}`;
  }

  private createPatternAnalysisPrompt(messages: Message[], existingPatterns?: string[]): string {
    const recentMessages = messages.slice(-TokenOptimizer.MAX_PATTERN_CONTEXT)
      .map(m => `${m.type}: ${m.content.slice(0, 150)}`)
      .join('\n');

    return `Analyze patterns in: ${recentMessages}
${existingPatterns ? `Known: ${existingPatterns.slice(0, 3).join(', ')}` : ''}
Find: preferences, style, interests. JSON format.`;
  }

  private createResponseGenerationPrompt(
    input: string, 
    history?: Message[], 
    style?: string
  ): string {
    const context = history?.slice(-3).map(m => `${m.type}: ${m.content.slice(0, 200)}`).join('\n') || '';
    
    return `${style ? `Style: ${style}\n` : ''}${context ? `Context: ${context}\n` : ''}User: ${input}
Respond helpfully:`;
  }

  private isHighImportanceMessage(message: Message): boolean {
    // Mark messages as important if they contain key information
    const importantKeywords = ['prefer', 'like', 'want', 'need', 'always', 'never', 'style'];
    return importantKeywords.some(keyword => 
      message.content.toLowerCase().includes(keyword)
    ) || !!message.isImage || (message.confidence !== undefined && message.confidence > 0.8);
  }

  private estimateTokensPrivate(messages: Message[]): number {
    return this.estimateTokens(messages);
  }

  private calculateCost(tokens: number, model: string): number {
    const baseRate = model.includes('lite') ? 0.00010 : TokenOptimizer.COST_PER_1K_TOKENS;
    return (tokens / 1000) * baseRate;
  }
}

// Singleton instance
export const tokenOptimizer = new TokenOptimizer();
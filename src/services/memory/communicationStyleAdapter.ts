import type { Message } from '~/types/conversation';
import { geminiClient } from '../models/geminiClient';

export interface CommunicationStyle {
  name: 'direct' | 'casual' | 'detailed' | 'creative' | 'technical' | 'formal';
  confidence: number;
  characteristics: string[];
  examples: string[];
}

export interface StyleAdaptationResult {
  detectedStyle: CommunicationStyle;
  adaptedPrompt: string;
  adaptationStrategy: string;
  confidenceScore: number;
}

export class CommunicationStyleAdapter {
  private static readonly STYLE_INDICATORS = {
    direct: {
      keywords: ['brief', 'quick', 'summary', 'short', 'simple', 'tldr'],
      patterns: ['short sentences', 'imperative mood', 'bullet points preference'],
      responseLength: 'short'
    },
    casual: {
      keywords: ['hey', 'thanks', 'cool', 'awesome', 'nice', 'great'],
      patterns: ['contractions', 'informal language', 'conversational tone'],
      responseLength: 'medium'
    },
    detailed: {
      keywords: ['explain', 'elaborate', 'details', 'comprehensive', 'thorough', 'deep'],
      patterns: ['long sentences', 'requests for examples', 'follow-up questions'],
      responseLength: 'long'
    },
    creative: {
      keywords: ['innovative', 'creative', 'unique', 'artistic', 'imaginative', 'original'],
      patterns: ['metaphors', 'analogies', 'storytelling elements'],
      responseLength: 'medium'
    },
    technical: {
      keywords: ['implement', 'algorithm', 'architecture', 'system', 'optimize', 'performance'],
      patterns: ['technical terms', 'specific implementation details', 'code references'],
      responseLength: 'long'
    },
    formal: {
      keywords: ['please', 'kindly', 'would you', 'could you', 'thank you'],
      patterns: ['complete sentences', 'polite language', 'structured requests'],
      responseLength: 'medium'
    }
  };

  async detectCommunicationStyle(messages: Message[]): Promise<CommunicationStyle> {
    if (messages.length < 3) {
      return {
        name: 'casual',
        confidence: 0.5,
        characteristics: ['insufficient_data'],
        examples: []
      };
    }

    const userMessages = messages.filter(m => m.type === 'user');
    const recentMessages = userMessages.slice(-5); // Analyze last 5 user messages
    
    // Calculate style scores
    const styleScores = this.calculateStyleScores(recentMessages);
    
    // Use AI for advanced style detection
    const aiStyleAnalysis = await this.performAIStyleAnalysis(recentMessages);
    
    // Combine rule-based and AI analysis
    const combinedScores = this.combineAnalyses(styleScores, aiStyleAnalysis);
    
    // Find dominant style
    const entries = Object.entries(combinedScores);
    const dominantStyle = entries.length > 0 
      ? entries.reduce((a, b) => combinedScores[a[0]]! > combinedScores[b[0]]! ? a : b)
      : ['casual', 0.5] as [string, number];
    
    return {
      name: dominantStyle[0] as CommunicationStyle['name'],
      confidence: dominantStyle[1],
      characteristics: this.extractCharacteristics(recentMessages, dominantStyle[0]),
      examples: recentMessages.slice(0, 2).map(m => m.content.slice(0, 100))
    };
  }

  async adaptResponseStyle(
    originalPrompt: string,
    detectedStyle: CommunicationStyle,
    userInput: string
  ): Promise<StyleAdaptationResult> {
    const adaptationStrategy = this.determineAdaptationStrategy(detectedStyle, userInput);
    const adaptedPrompt = this.createStyleAdaptedPrompt(originalPrompt, detectedStyle, adaptationStrategy);
    
    return {
      detectedStyle,
      adaptedPrompt,
      adaptationStrategy,
      confidenceScore: detectedStyle.confidence
    };
  }

  private calculateStyleScores(messages: Message[]): Record<string, number> {
    const scores: Record<string, number> = {
      direct: 0, casual: 0, detailed: 0, creative: 0, technical: 0, formal: 0
    };

    for (const message of messages) {
      const content = message.content.toLowerCase();
      const words = content.split(' ');
      
      // Analyze each style
      for (const [styleName, indicators] of Object.entries(CommunicationStyleAdapter.STYLE_INDICATORS)) {
        let styleScore = 0;
        
        // Keyword matching
        const keywordMatches = indicators.keywords.filter(keyword => 
          content.includes(keyword)
        ).length;
        styleScore += keywordMatches * 0.3;
        
        // Length analysis
        if (indicators.responseLength === 'short' && words.length < 20) styleScore += 0.2;
        if (indicators.responseLength === 'long' && words.length > 50) styleScore += 0.2;
        if (indicators.responseLength === 'medium' && words.length >= 20 && words.length <= 50) styleScore += 0.1;
        
        // Sentence structure analysis
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
        
        if (styleName === 'direct' && avgSentenceLength < 10) styleScore += 0.2;
        if (styleName === 'detailed' && avgSentenceLength > 15) styleScore += 0.2;
        if (styleName === 'formal' && content.includes('please') || content.includes('thank you')) styleScore += 0.3;
        
        if (scores[styleName] !== undefined) {
          scores[styleName] += styleScore;
        }
      }
    }
    
    // Normalize scores
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
      for (const style in scores) {
        if (scores[style] !== undefined) {
          scores[style] = Math.min(scores[style] / maxScore, 1.0);
        }
      }
    }
    
    return scores;
  }

  private async performAIStyleAnalysis(messages: Message[]): Promise<Record<string, number>> {
    try {
      const conversationText = messages
        .map(m => m.content)
        .join('\n')
        .slice(0, 800); // Limit for token efficiency

      const stylePrompt = `Analyze communication style in: "${conversationText}"
Rate 0.0-1.0: {"direct":0.0,"casual":0.0,"detailed":0.0,"creative":0.0,"technical":0.0,"formal":0.0}`;

      const response = await geminiClient.generateText(
        stylePrompt,
        [],
        { model: 'gemini-2.5-flash-lite-preview-06-17' },
        'pattern_analysis'
      );

      const jsonMatch = /\{[^}]*\}/.exec(response.content);
      if (jsonMatch?.[0]) {
        return JSON.parse(jsonMatch[0]) as Record<string, number>;
      }
    } catch (error) {
      console.warn('AI style analysis failed:', error);
    }

    // Fallback to neutral scores
    return { direct: 0.3, casual: 0.5, detailed: 0.3, creative: 0.2, technical: 0.2, formal: 0.3 };
  }

  private combineAnalyses(
    ruleBasedScores: Record<string, number>,
    aiScores: Record<string, number>
  ): Record<string, number> {
    const combined: Record<string, number> = {};
    
    for (const style in ruleBasedScores) {
      // Weight: 60% rule-based, 40% AI analysis
      const ruleScore = ruleBasedScores[style] ?? 0;
      const aiScore = aiScores[style] ?? 0;
      combined[style] = (ruleScore * 0.6) + (aiScore * 0.4);
    }
    
    return combined;
  }

  private extractCharacteristics(messages: Message[], styleName: string): string[] {
    const characteristics: string[] = [];
    const indicators = CommunicationStyleAdapter.STYLE_INDICATORS[styleName as keyof typeof CommunicationStyleAdapter.STYLE_INDICATORS];
    
    if (indicators) {
      characteristics.push(`Prefers ${indicators.responseLength} responses`);
      characteristics.push(...indicators.patterns);
    }
    
    // Add dynamic characteristics based on actual messages
    const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / messages.length;
    if (avgLength < 50) characteristics.push('Concise communicator');
    if (avgLength > 200) characteristics.push('Detailed communicator');
    
    return characteristics.slice(0, 3); // Limit to top 3
  }

  private determineAdaptationStrategy(style: CommunicationStyle, userInput: string): string {
    const strategies = {
      direct: 'Use concise, actionable language. Provide clear, immediate answers without unnecessary elaboration.',
      casual: 'Use friendly, conversational tone. Include casual expressions and maintain approachable language.',
      detailed: 'Provide comprehensive explanations with examples. Include background context and step-by-step reasoning.',
      creative: 'Use engaging, imaginative language. Include metaphors, analogies, and creative examples.',
      technical: 'Use precise technical terminology. Include implementation details and technical considerations.',
      formal: 'Use professional, polite language. Structure responses clearly with proper formatting.'
    };

    let strategy = strategies[style.name];
    
    // Adjust based on user input complexity
    if (userInput.length > 200) {
      strategy += ' Match the user\'s detailed communication style.';
    }
    
    return strategy;
  }

  private createStyleAdaptedPrompt(
    originalPrompt: string,
    style: CommunicationStyle,
    strategy: string
  ): string {
    const stylePrefix = `Communication style: ${style.name} (${Math.round(style.confidence * 100)}% confidence)
Adaptation strategy: ${strategy}

`;

    // Add style-specific instructions
    const styleInstructions = {
      direct: 'Keep response under 100 words. Use bullet points if listing items.',
      casual: 'Use friendly, conversational tone. It\'s okay to use contractions.',
      detailed: 'Provide thorough explanation with examples. Aim for 150-300 words.',
      creative: 'Use engaging language and creative examples. Make it interesting to read.',
      technical: 'Include technical details and implementation considerations. Be precise.',
      formal: 'Use professional language. Structure response with clear paragraphs.'
    };

    return `${stylePrefix}Style instruction: ${styleInstructions[style.name]}

${originalPrompt}`;
  }
}

// Singleton instance
export const communicationStyleAdapter = new CommunicationStyleAdapter();
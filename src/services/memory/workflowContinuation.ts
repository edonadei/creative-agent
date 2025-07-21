import type { Message, ConversationPattern, MemoryInsight } from '~/types/conversation';
import { geminiClient } from '../models/geminiClient';
import { patternRecognition } from './patternRecognition';

export interface WorkflowSuggestion {
  id: string;
  type: 'next_step' | 'related_topic' | 'follow_up' | 'exploration' | 'completion';
  title: string;
  description: string;
  prompt: string;
  confidence: number;
  reasoning: string;
  basedOnPatterns: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface WorkflowContinuationResult {
  suggestions: WorkflowSuggestion[];
  conversationState: 'beginning' | 'developing' | 'deep_dive' | 'conclusion' | 'transition';
  nextBestActions: string[];
  reasoning: string[];
}

export class WorkflowContinuation {
  private static readonly MAX_SUGGESTIONS = 5;
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.3;

  /**
   * Generate workflow continuation suggestions based on conversation patterns
   */
  async generateContinuationSuggestions(
    messages: Message[],
    patterns: ConversationPattern[],
    memoryInsights: MemoryInsight
  ): Promise<WorkflowContinuationResult> {
    if (messages.length < 2) {
      return this.generateInitialSuggestions();
    }

    const reasoning: string[] = [];
    
    // 1. Analyze conversation state
    const conversationState = this.analyzeConversationState(messages);
    reasoning.push(`Conversation state: ${conversationState}`);
    
    // 2. Identify incomplete workflows
    const incompleteWorkflows = this.identifyIncompleteWorkflows(messages, patterns);
    reasoning.push(`Found ${incompleteWorkflows.length} incomplete workflows`);
    
    // 3. Generate pattern-based suggestions
    const patternSuggestions = await this.generatePatternBasedSuggestions(
      messages,
      patterns,
      memoryInsights
    );
    reasoning.push(`Generated ${patternSuggestions.length} pattern-based suggestions`);
    
    // 4. Generate contextual follow-ups
    const contextualSuggestions = await this.generateContextualFollowUps(messages);
    reasoning.push(`Generated ${contextualSuggestions.length} contextual suggestions`);
    
    // 5. Generate exploration suggestions
    const explorationSuggestions = this.generateExplorationSuggestions(
      messages,
      memoryInsights
    );
    reasoning.push(`Generated ${explorationSuggestions.length} exploration suggestions`);
    
    // 6. Combine and rank suggestions
    const allSuggestions = [
      ...patternSuggestions,
      ...contextualSuggestions,
      ...explorationSuggestions,
      ...incompleteWorkflows
    ];
    
    const rankedSuggestions = this.rankSuggestions(allSuggestions, conversationState);
    const topSuggestions = rankedSuggestions
      .filter(s => s.confidence > WorkflowContinuation.MIN_CONFIDENCE_THRESHOLD)
      .slice(0, WorkflowContinuation.MAX_SUGGESTIONS);
    
    // 7. Generate next best actions
    const nextBestActions = this.generateNextBestActions(topSuggestions, conversationState);
    
    return {
      suggestions: topSuggestions,
      conversationState,
      nextBestActions,
      reasoning
    };
  }

  /**
   * Generate suggestions for specific workflow patterns
   */
  async generateWorkflowSpecificSuggestions(
    workflowType: string,
    currentContext: string,
    userPreferences: string[]
  ): Promise<WorkflowSuggestion[]> {
    const suggestions: WorkflowSuggestion[] = [];
    
    const workflowTemplates = this.getWorkflowTemplates(workflowType);
    
    for (const template of workflowTemplates) {
      if (this.isRelevantToContext(template, currentContext, userPreferences)) {
        suggestions.push({
          id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: template.type,
          title: template.title,
          description: template.description,
          prompt: this.personalizePrompt(template.prompt, userPreferences),
          confidence: template.baseConfidence,
          reasoning: `Based on ${workflowType} workflow pattern`,
          basedOnPatterns: [workflowType],
          priority: template.priority
        });
      }
    }
    
    return suggestions;
  }

  private generateInitialSuggestions(): WorkflowContinuationResult {
    return {
      suggestions: [
        {
          id: 'initial_1',
          type: 'exploration',
          title: 'Tell me about your project',
          description: 'Share details about what you\'re working on',
          prompt: 'Tell me about your current project or what you\'d like to work on',
          confidence: 0.8,
          reasoning: 'Standard conversation starter',
          basedOnPatterns: [],
          priority: 'high'
        },
        {
          id: 'initial_2',
          type: 'exploration',
          title: 'Ask a specific question',
          description: 'Get help with a particular problem or topic',
          prompt: 'What specific question or problem can I help you with?',
          confidence: 0.8,
          reasoning: 'Standard conversation starter',
          basedOnPatterns: [],
          priority: 'high'
        },
        {
          id: 'initial_3',
          type: 'exploration',
          title: 'Explore creative ideas',
          description: 'Generate and discuss creative concepts',
          prompt: 'Let\'s explore some creative ideas together',
          confidence: 0.7,
          reasoning: 'Standard conversation starter',
          basedOnPatterns: [],
          priority: 'medium'
        }
      ],
      conversationState: 'beginning',
      nextBestActions: [
        'Ask about the user\'s goals',
        'Understand the context',
        'Identify preferred communication style'
      ],
      reasoning: ['Initial conversation - providing standard starter suggestions']
    };
  }

  private analyzeConversationState(messages: Message[]): 'beginning' | 'developing' | 'deep_dive' | 'conclusion' | 'transition' {
    const userMessages = messages.filter(m => m.type === 'user');
    const messageCount = userMessages.length;
    
    if (messageCount <= 2) return 'beginning';
    if (messageCount <= 5) return 'developing';
    
    // Analyze recent messages for state indicators
    const recentMessages = userMessages.slice(-3);
    const recentContent = recentMessages.map(m => m.content.toLowerCase()).join(' ');
    
    // Check for conclusion indicators
    if (recentContent.includes('thanks') || recentContent.includes('that\'s all') || 
        recentContent.includes('goodbye') || recentContent.includes('that helps')) {
      return 'conclusion';
    }
    
    // Check for transition indicators
    if (recentContent.includes('now') || recentContent.includes('next') || 
        recentContent.includes('switch') || recentContent.includes('move on')) {
      return 'transition';
    }
    
    // Check for deep dive indicators
    if (recentContent.includes('detail') || recentContent.includes('explain more') ||
        recentContent.includes('elaborate') || recentContent.includes('deep')) {
      return 'deep_dive';
    }
    
    return 'developing';
  }

  private identifyIncompleteWorkflows(
    messages: Message[],
    patterns: ConversationPattern[]
  ): WorkflowSuggestion[] {
    const suggestions: WorkflowSuggestion[] = [];
    
    // Look for incomplete programming workflows
    const hasCodingPatterns = patterns.some(p => 
      p.pattern.includes('code') || p.pattern.includes('function') || p.pattern.includes('implement')
    );
    
    if (hasCodingPatterns) {
      const recentContent = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
      
      if (recentContent.includes('function') && !recentContent.includes('test')) {
        suggestions.push({
          id: 'incomplete_test',
          type: 'next_step',
          title: 'Add tests for your function',
          description: 'Write tests to verify your code works correctly',
          prompt: 'Can you help me write tests for the function we just created?',
          confidence: 0.7,
          reasoning: 'Code was discussed but no testing mentioned',
          basedOnPatterns: ['coding_workflow'],
          priority: 'high'
        });
      }
      
      if (recentContent.includes('implement') && !recentContent.includes('optimize')) {
        suggestions.push({
          id: 'incomplete_optimize',
          type: 'follow_up',
          title: 'Optimize the implementation',
          description: 'Review and improve the code for better performance',
          prompt: 'How can we optimize this implementation for better performance?',
          confidence: 0.6,
          reasoning: 'Implementation discussed but optimization not covered',
          basedOnPatterns: ['coding_workflow'],
          priority: 'medium'
        });
      }
    }
    
    return suggestions;
  }

  private async generatePatternBasedSuggestions(
    messages: Message[],
    patterns: ConversationPattern[],
    memoryInsights: MemoryInsight
  ): Promise<WorkflowSuggestion[]> {
    const suggestions: WorkflowSuggestion[] = [];
    
    // Analyze dominant patterns
    const dominantPatterns = patterns
      .filter(p => p.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    
    for (const pattern of dominantPatterns) {
      const patternSuggestions = await this.generateSuggestionsForPattern(pattern, messages, memoryInsights);
      suggestions.push(...patternSuggestions);
    }
    
    return suggestions;
  }

  private async generateSuggestionsForPattern(
    pattern: ConversationPattern,
    messages: Message[],
    memoryInsights: MemoryInsight
  ): Promise<WorkflowSuggestion[]> {
    const suggestions: WorkflowSuggestion[] = [];
    
    if (pattern.type === 'domain_interest') {
      const interest = pattern.pattern;
      suggestions.push({
        id: `pattern_${pattern.id}`,
        type: 'related_topic',
        title: `Explore more about ${interest}`,
        description: `Dive deeper into ${interest} based on your interests`,
        prompt: `Tell me more about ${interest} and how it relates to your goals`,
        confidence: pattern.confidence * 0.8,
        reasoning: `User has shown interest in ${interest}`,
        basedOnPatterns: [pattern.pattern],
        priority: pattern.confidence > 0.7 ? 'high' : 'medium'
      });
    }
    
    if (pattern.type === 'intent_sequence') {
      const sequence = pattern.pattern;
      suggestions.push({
        id: `sequence_${pattern.id}`,
        type: 'next_step',
        title: 'Continue the workflow',
        description: `Follow the established pattern: ${sequence}`,
        prompt: `Let's continue with the next step in our workflow`,
        confidence: pattern.confidence * 0.9,
        reasoning: `Established workflow pattern: ${sequence}`,
        basedOnPatterns: [pattern.pattern],
        priority: 'high'
      });
    }
    
    return suggestions;
  }

  private async generateContextualFollowUps(messages: Message[]): Promise<WorkflowSuggestion[]> {
    const suggestions: WorkflowSuggestion[] = [];
    
    if (messages.length < 2) return suggestions;
    
    const lastUserMessage = messages.filter(m => m.type === 'user').pop();
    const lastAiMessage = messages.filter(m => m.type === 'assistant').pop();
    
    if (!lastUserMessage || !lastAiMessage) return suggestions;
    
    // Use AI to generate contextual follow-ups
    try {
      const prompt = `Based on this conversation context:
User: "${lastUserMessage.content}"
Assistant: "${lastAiMessage.content.slice(0, 200)}"

Suggest 2-3 natural follow-up questions or next steps. Format as JSON:
{"suggestions": [{"title": "...", "description": "...", "prompt": "..."}]}`;

      const response = await geminiClient.generateText(
        prompt,
        [],
        { model: 'gemini-2.5-flash-lite-preview-06-17' },
        'pattern_analysis'
      );
      
      const jsonMatch = /\{[\s\S]*\}/.exec(response.content);
      if (jsonMatch?.[0]) {
        const parsed = JSON.parse(jsonMatch[0]) as { suggestions: Array<{ title: string; description: string; prompt: string }> };
        
        parsed.suggestions.forEach((suggestion, index) => {
          suggestions.push({
            id: `contextual_${Date.now()}_${index}`,
            type: 'follow_up',
            title: suggestion.title,
            description: suggestion.description,
            prompt: suggestion.prompt,
            confidence: 0.6,
            reasoning: 'AI-generated contextual follow-up',
            basedOnPatterns: ['conversation_context'],
            priority: 'medium'
          });
        });
      }
    } catch (error) {
      console.warn('Failed to generate contextual follow-ups:', error);
    }
    
    return suggestions;
  }

  private generateExplorationSuggestions(
    messages: Message[],
    memoryInsights: MemoryInsight
  ): WorkflowSuggestion[] {
    const suggestions: WorkflowSuggestion[] = [];
    
    // Suggest exploring user's top interests
    const topInterests = memoryInsights.topicInterests.slice(0, 2);
    
    for (const interest of topInterests) {
      suggestions.push({
        id: `explore_${interest.replace(/\s+/g, '_')}`,
        type: 'exploration',
        title: `Deep dive into ${interest}`,
        description: `Explore ${interest} in greater detail`,
        prompt: `I'd like to explore ${interest} in more depth. What aspects interest you most?`,
        confidence: 0.5,
        reasoning: `Based on your interest in ${interest}`,
        basedOnPatterns: ['topic_interest'],
        priority: 'low'
      });
    }
    
    // Suggest cross-domain connections
    if (topInterests.length >= 2) {
      suggestions.push({
        id: 'cross_domain',
        type: 'exploration',
        title: `Connect ${topInterests[0]} and ${topInterests[1]}`,
        description: `Explore how these topics relate to each other`,
        prompt: `How do ${topInterests[0]} and ${topInterests[1]} connect? Are there interesting intersections?`,
        confidence: 0.4,
        reasoning: 'Encouraging cross-domain thinking',
        basedOnPatterns: ['topic_interest'],
        priority: 'low'
      });
    }
    
    return suggestions;
  }

  private rankSuggestions(
    suggestions: WorkflowSuggestion[],
    conversationState: string
  ): WorkflowSuggestion[] {
    return suggestions
      .map(suggestion => {
        // Boost confidence based on conversation state
        let stateBoost = 0;
        
        if (conversationState === 'beginning' && suggestion.type === 'exploration') {
          stateBoost = 0.2;
        } else if (conversationState === 'developing' && suggestion.type === 'next_step') {
          stateBoost = 0.3;
        } else if (conversationState === 'deep_dive' && suggestion.type === 'follow_up') {
          stateBoost = 0.2;
        } else if (conversationState === 'transition' && suggestion.type === 'related_topic') {
          stateBoost = 0.2;
        }
        
        return {
          ...suggestion,
          confidence: Math.min(suggestion.confidence + stateBoost, 1.0)
        };
      })
      .sort((a, b) => {
        // Primary sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by confidence
        return b.confidence - a.confidence;
      });
  }

  private generateNextBestActions(
    suggestions: WorkflowSuggestion[],
    conversationState: string
  ): string[] {
    const actions: string[] = [];
    
    if (suggestions.length > 0 && suggestions[0]) {
      actions.push(`Try: "${suggestions[0].title}"`);
    }
    
    // Add state-specific actions
    switch (conversationState) {
      case 'beginning':
        actions.push('Share your goals or current project');
        actions.push('Ask a specific question');
        break;
      case 'developing':
        actions.push('Provide more context');
        actions.push('Ask for examples or clarification');
        break;
      case 'deep_dive':
        actions.push('Request more detailed explanation');
        actions.push('Ask about implementation details');
        break;
      case 'transition':
        actions.push('Introduce a new topic');
        actions.push('Connect to previous discussion');
        break;
      case 'conclusion':
        actions.push('Ask follow-up questions');
        actions.push('Start a new conversation thread');
        break;
    }
    
    return actions.slice(0, 4); // Limit to 4 actions
  }

  private getWorkflowTemplates(workflowType: string): Array<{
    type: WorkflowSuggestion['type'];
    title: string;
    description: string;
    prompt: string;
    baseConfidence: number;
    priority: WorkflowSuggestion['priority'];
  }> {
    const templates = {
      coding: [
        {
          type: 'next_step' as const,
          title: 'Review and refactor',
          description: 'Clean up and optimize the code',
          prompt: 'Let\'s review and refactor this code for better quality',
          baseConfidence: 0.7,
          priority: 'medium' as const
        },
        {
          type: 'follow_up' as const,
          title: 'Add error handling',
          description: 'Implement proper error handling',
          prompt: 'How should we handle errors in this implementation?',
          baseConfidence: 0.8,
          priority: 'high' as const
        }
      ],
      research: [
        {
          type: 'exploration' as const,
          title: 'Find related sources',
          description: 'Explore additional research materials',
          prompt: 'What other sources should we look into for this topic?',
          baseConfidence: 0.6,
          priority: 'medium' as const
        }
      ]
    };
    
    return templates[workflowType as keyof typeof templates] ?? [];
  }

  private isRelevantToContext(
    template: any,
    context: string,
    preferences: string[]
  ): boolean {
    // Simple relevance check
    const contextLower = context.toLowerCase();
    const titleLower = template.title.toLowerCase();
    
    return preferences.some(pref => 
      titleLower.includes(pref.toLowerCase()) || 
      contextLower.includes(pref.toLowerCase())
    );
  }

  private personalizePrompt(prompt: string, preferences: string[]): string {
    // Simple personalization based on preferences
    if (preferences.includes('detailed')) {
      return prompt + ' Please provide detailed information.';
    }
    if (preferences.includes('concise')) {
      return prompt + ' Keep it brief and to the point.';
    }
    return prompt;
  }
}

// Singleton instance
export const workflowContinuation = new WorkflowContinuation();
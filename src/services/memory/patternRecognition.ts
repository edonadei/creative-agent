import type { 
  Message, 
  ConversationPattern, 
  MemoryInsight 
} from '~/types/conversation';
import { geminiClient } from '../models/geminiClient';

export class PatternRecognitionEngine {
  private static readonly STORAGE_KEY = 'awen-conversation-patterns';
  private static readonly MIN_PATTERN_OCCURRENCES = 2;
  private static readonly PATTERN_CONFIDENCE_THRESHOLD = 0.6;

  async analyzeConversation(messages: Message[]): Promise<ConversationPattern[]> {
    if (messages.length < 3) {
      return []; // Need minimum conversation to detect patterns
    }

    try {
      const analysisPrompt = this.buildPatternAnalysisPrompt(messages);
      const response = await geminiClient.generateText(analysisPrompt, [], {
        model: 'gemini-2.5-flash',
        temperature: 0.3,
      });

      return this.parsePatternResponse(response.content);
    } catch (error) {
      console.error('Pattern analysis error:', error);
      return this.fallbackPatternDetection(messages);
    }
  }

  async updatePatterns(
    newMessage: Message, 
    response: Message, 
    existingPatterns: ConversationPattern[]
  ): Promise<ConversationPattern[]> {
    // Update existing patterns based on new interaction
    const updatedPatterns = [...existingPatterns];
    
    // Check if new interaction reinforces existing patterns
    for (const pattern of updatedPatterns) {
      if (this.matchesPattern(newMessage, response, pattern)) {
        pattern.occurrences++;
        pattern.confidence = Math.min(pattern.confidence + 0.1, 1.0);
        pattern.lastSeen = new Date();
        pattern.examples.push(this.formatInteractionExample(newMessage, response));
        
        // Keep only recent examples (max 5)
        if (pattern.examples.length > 5) {
          pattern.examples = pattern.examples.slice(-5);
        }
      }
    }

    // Detect new patterns from this interaction
    const newPatterns = await this.detectNewPatterns(newMessage, response, existingPatterns);
    updatedPatterns.push(...newPatterns);

    // Clean up old or low-confidence patterns
    return this.cleanupPatterns(updatedPatterns);
  }

  async generateMemoryInsights(
    patterns: ConversationPattern[],
    recentMessages: Message[]
  ): Promise<MemoryInsight> {
    if (patterns.length === 0) {
      return this.getDefaultInsights();
    }

    try {
      const insightPrompt = this.buildInsightPrompt(patterns, recentMessages);
      const response = await geminiClient.generateText(insightPrompt, [], {
        model: 'gemini-2.5-flash',
        temperature: 0.2,
      });

      return this.parseInsightResponse(response.content, patterns);
    } catch (error) {
      console.error('Insight generation error:', error);
      return this.fallbackInsightGeneration(patterns);
    }
  }

  private buildPatternAnalysisPrompt(messages: Message[]): string {
    const conversationText = messages
      .map(m => `${m.type}: ${m.content}`)
      .join('\n');

    return `
Analyze this conversation to identify user patterns. Look for:

1. USER PREFERENCES: What does the user consistently prefer? (style, format, detail level)
2. COMMUNICATION STYLE: How does the user communicate? (formal/casual, brief/detailed)
3. DOMAIN INTERESTS: What topics/domains is the user interested in?
4. INTENT SEQUENCES: What request patterns does the user follow?

Conversation:
${conversationText}

IMPORTANT: Respond with ONLY valid JSON. No additional text before or after the JSON.

Respond in this exact JSON format:
[
  {
    "type": "preference",
    "pattern": "brief description",
    "confidence": 0.8,
    "examples": ["exact quote from conversation"]
  }
]

Rules:
- Use only these types: "preference", "communication_style", "domain_interest", "intent_sequence"
- Confidence must be a number between 0.0 and 1.0
- Examples must be actual quotes from the conversation
- No trailing commas
- Use double quotes only
- Maximum 5 patterns

Only include patterns with confidence > 0.6 and clear evidence from the conversation.`;
  }

  private buildInsightPrompt(patterns: ConversationPattern[], recentMessages: Message[]): string {
    const patternSummary = patterns
      .map(p => `${p.type}: ${p.pattern} (confidence: ${p.confidence})`)
      .join('\n');

    const recentContext = recentMessages.slice(-5)
      .map(m => `${m.type}: ${m.content}`)
      .join('\n');

    return `
Based on detected conversation patterns and recent context, generate user insights:

Patterns:
${patternSummary}

Recent context:
${recentContext}

Generate insights in JSON format:
{
  "userPreferences": {"preference": confidence_score},
  "communicationStyle": "direct|casual|detailed|creative",
  "topicInterests": ["topic1", "topic2"],
  "sessionContext": "brief description of current session context"
}`;
  }

  private parsePatternResponse(content: string): ConversationPattern[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      // Clean the JSON string to fix common issues
      let jsonString = jsonMatch[0];
      
      // Remove trailing commas before closing brackets/braces
      jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');
      
      // Fix common quote issues
      jsonString = jsonString.replace(/'/g, '"');
      
      // Ensure proper escaping of quotes within strings
      jsonString = jsonString.replace(/"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3"');

      const patterns = JSON.parse(jsonString) as Array<{
        type: string;
        pattern: string;
        confidence: number;
        examples: string[];
      }>;

      return patterns
        .filter(p => p && typeof p === 'object' && p.pattern && typeof p.confidence === 'number')
        .filter(p => p.confidence >= PatternRecognitionEngine.PATTERN_CONFIDENCE_THRESHOLD)
        .map(p => ({
          id: this.generatePatternId(p.pattern),
          type: p.type as ConversationPattern['type'],
          pattern: p.pattern,
          confidence: p.confidence,
          occurrences: 1,
          lastSeen: new Date(),
          examples: Array.isArray(p.examples) ? p.examples : [],
        }));
    } catch (error) {
      console.error('Pattern parsing error:', error);
      console.log('Raw content:', content);
      
      // Fallback: try to extract patterns manually
      return this.fallbackPatternParsing(content);
    }
  }

  private parseInsightResponse(content: string, patterns: ConversationPattern[]): MemoryInsight {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.fallbackInsightGeneration(patterns);

      const insights = JSON.parse(jsonMatch[0]);
      
      return {
        userPreferences: insights.userPreferences || {},
        communicationStyle: insights.communicationStyle || 'casual',
        topicInterests: insights.topicInterests || [],
        intentPatterns: this.extractIntentPatterns(patterns),
        sessionContext: insights.sessionContext || 'General conversation',
      };
    } catch (error) {
      console.error('Insight parsing error:', error);
      return this.fallbackInsightGeneration(patterns);
    }
  }

  private fallbackPatternParsing(content: string): ConversationPattern[] {
    // Try to extract patterns from malformed JSON using regex
    const patterns: ConversationPattern[] = [];
    
    // Look for pattern-like structures in the text
    const patternMatches = content.match(/"pattern":\s*"([^"]+)"/g);
    const typeMatches = content.match(/"type":\s*"([^"]+)"/g);
    const confidenceMatches = content.match(/"confidence":\s*([\d.]+)/g);
    
    if (patternMatches && typeMatches && confidenceMatches) {
      const minLength = Math.min(patternMatches.length, typeMatches.length, confidenceMatches.length);
      
      for (let i = 0; i < minLength; i++) {
        const pattern = patternMatches[i]?.match(/"pattern":\s*"([^"]+)"/)?.[1];
        const type = typeMatches[i]?.match(/"type":\s*"([^"]+)"/)?.[1];
        const confidence = parseFloat(confidenceMatches[i]?.match(/"confidence":\s*([\d.]+)/)?.[1] ?? '0');
        
        if (pattern && type && confidence >= PatternRecognitionEngine.PATTERN_CONFIDENCE_THRESHOLD) {
          patterns.push({
            id: this.generatePatternId(pattern),
            type: type as ConversationPattern['type'],
            pattern,
            confidence,
            occurrences: 1,
            lastSeen: new Date(),
            examples: [],
          });
        }
      }
    }
    
    return patterns;
  }

  private fallbackPatternDetection(messages: Message[]): ConversationPattern[] {
    const patterns: ConversationPattern[] = [];
    
    // Simple keyword-based pattern detection
    const userMessages = messages.filter(m => m.type === 'user');
    const imageRequests = userMessages.filter(m => 
      m.content.toLowerCase().includes('image') || 
      m.content.toLowerCase().includes('generate') ||
      m.content.toLowerCase().includes('create')
    );

    if (imageRequests.length >= 2) {
      patterns.push({
        id: 'image_preference',
        type: 'preference',
        pattern: 'User frequently requests image generation',
        confidence: 0.7,
        occurrences: imageRequests.length,
        lastSeen: new Date(),
        examples: imageRequests.slice(0, 3).map(m => m.content),
      });
    }

    return patterns;
  }

  private fallbackInsightGeneration(patterns: ConversationPattern[]): MemoryInsight {
    const preferences: Record<string, number> = {};
    let communicationStyle: MemoryInsight['communicationStyle'] = 'casual';
    const topicInterests: string[] = [];

    // Extract basic insights from patterns
    for (const pattern of patterns) {
      if (pattern.type === 'preference') {
        preferences[pattern.pattern] = pattern.confidence;
      } else if (pattern.type === 'domain_interest') {
        topicInterests.push(pattern.pattern);
      }
    }

    return {
      userPreferences: preferences,
      communicationStyle,
      topicInterests,
      intentPatterns: this.extractIntentPatterns(patterns),
      sessionContext: 'Conversation in progress',
    };
  }

  private getDefaultInsights(): MemoryInsight {
    return {
      userPreferences: {},
      communicationStyle: 'casual',
      topicInterests: [],
      intentPatterns: [],
      sessionContext: 'New conversation',
    };
  }

  private matchesPattern(newMessage: Message, response: Message, pattern: ConversationPattern): boolean {
    // Simple matching - in production, this would be more sophisticated
    const content = `${newMessage.content} ${response.content}`.toLowerCase();
    const patternKeywords = pattern.pattern.toLowerCase().split(' ');
    
    return patternKeywords.some(keyword => content.includes(keyword));
  }

  private async detectNewPatterns(
    _newMessage: Message, 
    _response: Message, 
    _existingPatterns: ConversationPattern[]
  ): Promise<ConversationPattern[]> {
    // For now, return empty array - this would contain logic to detect emerging patterns
    return [];
  }

  private cleanupPatterns(patterns: ConversationPattern[]): ConversationPattern[] {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return patterns.filter(pattern => {
      // Keep patterns that are recent or have high confidence/occurrences
      return pattern.lastSeen > oneWeekAgo || 
             pattern.confidence > 0.8 || 
             pattern.occurrences >= PatternRecognitionEngine.MIN_PATTERN_OCCURRENCES;
    });
  }

  private extractIntentPatterns(patterns: ConversationPattern[]): Array<{sequence: string[], frequency: number}> {
    return patterns
      .filter(p => p.type === 'intent_sequence')
      .map(p => ({
        sequence: p.pattern.split(' -> '),
        frequency: p.occurrences,
      }));
  }

  private formatInteractionExample(userMessage: Message, response: Message): string {
    return `User: ${userMessage.content.slice(0, 50)}... → AI: ${response.content.slice(0, 50)}...`;
  }

  private generatePatternId(pattern: string): string {
    return `pattern_${Date.now()}_${pattern.replace(/\s+/g, '_').slice(0, 20)}`;
  }

  // Storage methods
  async savePatterns(sessionId: string, patterns: ConversationPattern[]): Promise<void> {
    // Check if we're running on the server side
    if (typeof window === 'undefined') {
      return; // Skip saving on server side
    }
    
    try {
      const stored = localStorage.getItem(PatternRecognitionEngine.STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      data[sessionId] = patterns;
      localStorage.setItem(PatternRecognitionEngine.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Pattern storage error:', error);
    }
  }

  async loadPatterns(sessionId: string): Promise<ConversationPattern[]> {
    // Check if we're running on the server side
    if (typeof window === 'undefined') {
      return []; // Return empty array on server side
    }
    
    try {
      const stored = localStorage.getItem(PatternRecognitionEngine.STORAGE_KEY);
      if (!stored) return [];
      
      const data = JSON.parse(stored);
      const patterns = data[sessionId] || [];
      
      // Convert date strings back to Date objects
      return patterns.map((p: any) => ({
        ...p,
        lastSeen: new Date(p.lastSeen),
      }));
    } catch (error) {
      console.error('Pattern loading error:', error);
      return [];
    }
  }
}

// Singleton instance
export const patternRecognition = new PatternRecognitionEngine();
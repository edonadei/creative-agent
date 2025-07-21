import type { Message } from '~/types/conversation';

export interface UserPreference {
  category: 'response_style' | 'content_type' | 'interaction_pattern' | 'topic_interest' | 'communication_preference';
  preference: string;
  strength: number; // 0.0-1.0
  confidence: number; // 0.0-1.0
  lastReinforced: Date;
  examples: string[];
  frequency: number;
}

export interface PreferenceLearningResult {
  newPreferences: UserPreference[];
  reinforcedPreferences: UserPreference[];
  confidence: number;
  reasoning: string[];
}

export interface UserPreferenceProfile {
  userId?: string;
  sessionId: string;
  preferences: UserPreference[];
  learningHistory: Array<{
    timestamp: Date;
    event: 'discovered' | 'reinforced' | 'weakened' | 'contradicted';
    preference: UserPreference;
    trigger: string;
  }>;
  adaptationStrategy: {
    responseStyle: string;
    contentFocus: string[];
    communicationApproach: string;
  };
  lastUpdated: Date;
}

// Interfaces for parsed JSON data
interface ParsedPreference {
  category: 'response_style' | 'content_type' | 'interaction_pattern' | 'topic_interest' | 'communication_preference';
  preference: string;
  strength: number;
  confidence: number;
  lastReinforced: string;
  examples: string[];
  frequency: number;
}

interface ParsedHistoryEvent {
  timestamp: string;
  event: 'discovered' | 'reinforced' | 'weakened' | 'contradicted';
  preference: ParsedPreference;
  trigger: string;
}

interface ParsedProfile {
  userId?: string;
  sessionId: string;
  preferences: ParsedPreference[];
  learningHistory: ParsedHistoryEvent[];
  adaptationStrategy: {
    responseStyle: string;
    contentFocus: string[];
    communicationApproach: string;
  };
  lastUpdated: string;
}

export class UserPreferenceLearning {
  private static readonly PREFERENCE_THRESHOLD = 0.3;
  private static readonly REINFORCEMENT_DECAY = 0.95; // Weekly decay rate

  /**
   * Analyze conversation to learn user preferences
   */
  async analyzeUserPreferences(
    messages: Message[],
    existingProfile?: UserPreferenceProfile
  ): Promise<PreferenceLearningResult> {
    const userMessages = messages.filter(m => m.type === 'user');
    const recentMessages = userMessages.slice(-5);

    if (recentMessages.length === 0) {
      return {
        newPreferences: [],
        reinforcedPreferences: [],
        confidence: 0,
        reasoning: ['No user messages to analyze']
      };
    }

    const newPreferences: UserPreference[] = [];
    const reinforcedPreferences: UserPreference[] = [];

    // Analyze response style preferences
    const responseStylePrefs = await this.analyzeResponseStylePreferences(messages);
    if (responseStylePrefs.newPreferences.length > 0) {
      newPreferences.push(...responseStylePrefs.newPreferences);
    }
    if (responseStylePrefs.reinforcedPreferences.length > 0) {
      reinforcedPreferences.push(...responseStylePrefs.reinforcedPreferences);
    }

    // Analyze content type preferences
    const contentTypePrefs = await this.analyzeContentTypePreferences(messages);
    if (contentTypePrefs.newPreferences.length > 0) {
      newPreferences.push(...contentTypePrefs.newPreferences);
    }
    if (contentTypePrefs.reinforcedPreferences.length > 0) {
      reinforcedPreferences.push(...contentTypePrefs.reinforcedPreferences);
    }

    // Analyze interaction patterns
    const interactionPrefs = await this.analyzeInteractionPatterns(messages);
    if (interactionPrefs.newPreferences.length > 0) {
      newPreferences.push(...interactionPrefs.newPreferences);
    }
    if (interactionPrefs.reinforcedPreferences.length > 0) {
      reinforcedPreferences.push(...interactionPrefs.reinforcedPreferences);
    }

    // Merge with existing preferences
    const { merged: mergedNew, reinforced: mergedReinforced } = await this.mergeWithExistingPreferences(
      newPreferences,
      reinforcedPreferences,
      existingProfile?.preferences ?? []
    );

    const confidence = this.calculateOverallConfidence(mergedNew, mergedReinforced);

    return {
      newPreferences: mergedNew,
      reinforcedPreferences: mergedReinforced,
      confidence,
      reasoning: [
        `Analyzed ${messages.length} messages`,
        `Found ${mergedNew.length} new preferences`,
        `Reinforced ${mergedReinforced.length} existing preferences`
      ]
    };
  }

  generateAdaptiveStrategy(preferences: UserPreference[]): {
    responseStyle: string;
    contentFocus: string[];
    communicationApproach: string;
  } {
    const responseStyle = this.findDominantPreference(preferences, 'response_style')?.preference ?? 'balanced';
    const contentFocus = preferences
      .filter(p => p.category === 'content_type' && p.strength > UserPreferenceLearning.PREFERENCE_THRESHOLD)
      .map(p => p.preference);
    const communicationApproach = this.determineCommunicationApproach(preferences);

    return {
      responseStyle,
      contentFocus,
      communicationApproach
    };
  }

  async savePreferenceProfile(profile: UserPreferenceProfile): Promise<void> {
    if (typeof window === 'undefined') {
      return; // Skip saving on server side
    }

    try {
      const profileKey = `user_preferences_${profile.sessionId}`;
      const serialized = JSON.stringify({
        ...profile,
        lastUpdated: profile.lastUpdated.toISOString(),
        preferences: profile.preferences.map(p => ({
          ...p,
          lastReinforced: p.lastReinforced.toISOString()
        })),
        learningHistory: profile.learningHistory.map(h => ({
          ...h,
          timestamp: h.timestamp.toISOString(),
          preference: {
            ...h.preference,
            lastReinforced: h.preference.lastReinforced.toISOString()
          }
        }))
      });
      
      localStorage.setItem(profileKey, serialized);
    } catch (error) {
      console.warn('Failed to save preference profile:', error);
    }
  }

  async loadPreferenceProfile(sessionId: string): Promise<UserPreferenceProfile | null> {
    if (typeof window === 'undefined') {
      return null; // Return null on server side
    }

    try {
      const profileKey = `user_preferences_${sessionId}`;
      const stored = localStorage.getItem(profileKey);
      
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as ParsedProfile;
      
      return {
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated),
        preferences: parsed.preferences.map((p: ParsedPreference): UserPreference => ({
          ...p,
          lastReinforced: new Date(p.lastReinforced)
        })),
        learningHistory: parsed.learningHistory.map((h: ParsedHistoryEvent) => ({
          ...h,
          timestamp: new Date(h.timestamp),
          preference: {
            ...h.preference,
            lastReinforced: new Date(h.preference.lastReinforced)
          }
        }))
      };
    } catch (error) {
      console.warn('Failed to load preference profile:', error);
      return null;
    }
  }

  private async analyzeResponseStylePreferences(messages: Message[]): Promise<{
    newPreferences: UserPreference[];
    reinforcedPreferences: UserPreference[];
  }> {
    const styleIndicators = this.extractStyleIndicators(messages);
    const newPreferences: UserPreference[] = [];

    for (const [style, strength] of Object.entries(styleIndicators)) {
      if (strength > UserPreferenceLearning.PREFERENCE_THRESHOLD) {
        newPreferences.push({
          category: 'response_style',
          preference: style,
          strength: strength,
          confidence: Math.min(strength * 1.2, 1.0),
          lastReinforced: new Date(),
          examples: messages.filter(m => m.type === 'user').map(m => m.content.slice(0, 100)),
          frequency: 1
        });
      }
    }

    return {
      newPreferences,
      reinforcedPreferences: []
    };
  }

  private async analyzeContentTypePreferences(messages: Message[]): Promise<{
    newPreferences: UserPreference[];
    reinforcedPreferences: UserPreference[];
  }> {
    const contentTypes = this.identifyContentTypes(messages);
    const newPreferences: UserPreference[] = [];

    for (const [type, frequency] of Object.entries(contentTypes)) {
      if (frequency > 0.2) {
        const normalizedFreq = frequency / messages.length;
        newPreferences.push({
          category: 'content_type',
          preference: type,
          strength: normalizedFreq,
          confidence: normalizedFreq,
          lastReinforced: new Date(),
          examples: messages.filter(m => m.type === 'user' && m.content.toLowerCase().includes(type)).map(m => m.content.slice(0, 100)),
          frequency: frequency
        });
      }
    }

    return {
      newPreferences,
      reinforcedPreferences: []
    };
  }

  private async analyzeInteractionPatterns(messages: Message[]): Promise<{
    newPreferences: UserPreference[];
    reinforcedPreferences: UserPreference[];
  }> {
    const patterns = this.identifyInteractionPatterns(messages);
    const newPreferences: UserPreference[] = [];

    for (const pattern of patterns) {
      newPreferences.push({
        category: 'interaction_pattern',
        preference: pattern.description,
        strength: pattern.strength,
        confidence: pattern.confidence,
        lastReinforced: new Date(),
        examples: pattern.examples,
        frequency: pattern.frequency
      });
    }

    return {
      newPreferences,
      reinforcedPreferences: []
    };
  }

  private extractStyleIndicators(messages: Message[]): Record<string, number> {
    const indicators: Record<string, number> = {
      'concise': 0,
      'detailed': 0,
      'casual': 0,
      'formal': 0,
      'technical': 0,
      'creative': 0
    };

    for (const message of messages) {
      if (message.type !== 'user') continue;

      const content = message.content.toLowerCase();
      const length = message.content.length;

      // Analyze message characteristics
      if (length < 50) indicators.concise = (indicators.concise ?? 0) + 0.3;
      if (length > 200) indicators.detailed = (indicators.detailed ?? 0) + 0.3;
      if (content.includes('please') || content.includes('thank')) indicators.formal = (indicators.formal ?? 0) + 0.2;
      if (content.includes('hey') || content.includes('cool')) indicators.casual = (indicators.casual ?? 0) + 0.2;
      if (content.includes('implement') || content.includes('function')) indicators.technical = (indicators.technical ?? 0) + 0.2;
      if (content.includes('creative') || content.includes('artistic')) indicators.creative = (indicators.creative ?? 0) + 0.2;
    }

    return indicators;
  }

  private identifyContentTypes(messages: Message[]): Record<string, number> {
    const types: Record<string, number> = {
      'code': 0,
      'explanation': 0,
      'creative': 0,
      'analysis': 0,
      'troubleshooting': 0,
      'learning': 0
    };

    for (const message of messages) {
      if (message.type !== 'user') continue;
      const content = message.content.toLowerCase();

      if (content.includes('code') || content.includes('function')) types.code = (types.code ?? 0) + 1;
      if (content.includes('explain') || content.includes('what')) types.explanation = (types.explanation ?? 0) + 1;
      if (content.includes('create') || content.includes('design')) types.creative = (types.creative ?? 0) + 1;
      if (content.includes('analyze') || content.includes('compare')) types.analysis = (types.analysis ?? 0) + 1;
      if (content.includes('error') || content.includes('fix')) types.troubleshooting = (types.troubleshooting ?? 0) + 1;
      if (content.includes('learn') || content.includes('how')) types.learning = (types.learning ?? 0) + 1;
    }

    return types;
  }

  private identifyInteractionPatterns(messages: Message[]): Array<{
    description: string;
    strength: number;
    confidence: number;
    examples: string[];
    frequency: number;
  }> {
    const patterns: Array<{
      description: string;
      strength: number;
      confidence: number;
      examples: string[];
      frequency: number;
    }> = [];

    // Calculate average time between messages (simplified)
    if (messages.length > 1) {
      patterns.push({
        description: 'quick_responses',
        strength: 0.7,
        confidence: 0.8,
        examples: ['Tends to ask follow-up questions quickly'],
        frequency: 1
      });
    }

    return patterns;
  }

  private async mergeWithExistingPreferences(
    newPrefs: UserPreference[],
    reinforcedPrefs: UserPreference[],
    existingPrefs: UserPreference[]
  ): Promise<{ merged: UserPreference[]; reinforced: UserPreference[] }> {
    const merged = [...newPrefs];
    const reinforced = [...reinforcedPrefs];

    // Apply decay to existing preferences
    const decayedExisting = existingPrefs.map(pref => ({
      ...pref,
      strength: pref.strength * UserPreferenceLearning.REINFORCEMENT_DECAY
    }));

    // Filter out weak preferences
    const strongExisting = decayedExisting.filter(p => p.strength > 0.1);

    // Merge with existing
    for (const existing of strongExisting) {
      const newMatch = merged.find(p => p.category === existing.category && p.preference === existing.preference);
      if (!newMatch) {
        merged.push(existing);
      }
    }

    return { merged, reinforced };
  }

  private findDominantPreference(preferences: UserPreference[], category: UserPreference['category']): UserPreference | null {
    const categoryPrefs = preferences.filter(p => p.category === category);
    if (categoryPrefs.length === 0) return null;

    return categoryPrefs.reduce((strongest, current) => 
      current.strength > strongest.strength ? current : strongest
    );
  }

  private determineCommunicationApproach(preferences: UserPreference[]): string {
    const stylePrefs = preferences.filter(p => p.category === 'response_style');
    if (stylePrefs.length === 0) return 'balanced';

    // Find the dominant communication approach based on preferences
    const approaches = stylePrefs.reduce((acc, pref) => {
      acc[pref.preference] = (acc[pref.preference] ?? 0) + pref.strength;
      return acc;
    }, {} as Record<string, number>);

    const dominantApproach = Object.entries(approaches).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    return dominantApproach;
  }

  private calculateOverallConfidence(
    newPrefs: UserPreference[],
    reinforcedPrefs: UserPreference[]
  ): number {
    const totalPrefs = newPrefs.length + reinforcedPrefs.length;
    if (totalPrefs === 0) return 0;

    const avgConfidence = (newPrefs.concat(reinforcedPrefs)).reduce((sum, p) => sum + p.confidence, 0) / totalPrefs;
    return Math.min(avgConfidence, 1.0);
  }
}

// Singleton instance
export const userPreferenceLearning = new UserPreferenceLearning();
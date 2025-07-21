export interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  isImage?: boolean;
  
  // Enhanced fields for memory and reasoning
  intent?: 'text' | 'image' | 'image_prompt' | 'clarify' | 'contextual_reasoning';
  confidence?: number;
  modelUsed?: string;
  processingTime?: number;
  actionLog?: ActionLog;
  clarificationContext?: string;
}

export interface GalleryImage {
  id: string;
  content: string;
  title: string;
  addedAt: Date;
  sourceMessageId?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: Message[];
  galleryImages: GalleryImage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationStore {
  sessions: Record<string, ConversationSession>;
  activeSessionId: string | null;
  lastUpdated: Date;
}

// Memory and reasoning types
export interface ConversationPattern {
  id: string;
  type: 'preference' | 'communication_style' | 'domain_interest' | 'intent_sequence';
  pattern: string;
  confidence: number;
  occurrences: number;
  lastSeen: Date;
  examples: string[];
}

export interface ContextualReasoning {
  userIntent: string;
  confidence: number;
  reasoning: string;
  basedOn: ConversationPattern[];
  hypotheticalNext: string[];
  conversationFlow: 'continuation' | 'topic_shift' | 'clarification_needed';
}

export interface MemoryInsight {
  userPreferences: Record<string, number>;
  communicationStyle: 'direct' | 'casual' | 'detailed' | 'creative';
  topicInterests: string[];
  intentPatterns: Array<{sequence: string[], frequency: number}>;
  sessionContext: string;
}

export interface ActionLog {
  timestamp: Date;
  action: string;
  input: string;
  output: string;
  modelUsed: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite-preview-06-17' | 'placeholder-generator' | 'gemini-prompt-generator';
  confidence: number;
  processingTime: number;
  
  // Enhanced logging
  contextualReasoning?: ContextualReasoning;
  memoryInsights?: MemoryInsight;
  conversationPatterns?: ConversationPattern[];
  reasoningChain?: string[];
  optimization?: {
    strategy: string;
    tokensSaved: number;
    estimatedCost: number;
    reasoning: string;
  };
}

export interface ConversationMemory {
  userId?: string;
  sessionFingerprint: string;
  patterns: ConversationPattern[];
  insights: MemoryInsight;
  conversationGraph: {
    topics: string[];
    transitions: Array<{from: string, to: string, frequency: number}>;
    preferences: Record<string, number>;
  };
  lastUpdated: Date;
  memoryVersion: number;
}
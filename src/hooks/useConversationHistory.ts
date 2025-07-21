import { useState, useEffect, useCallback } from 'react';
import type { Message, ConversationSession, ConversationStore, GalleryImage } from '~/types/conversation';

const STORAGE_KEY = 'awen-conversations';
const LEGACY_STORAGE_KEY = 'awen-conversation-history';

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(msg => msg.type === 'user');
  if (firstUserMessage) {
    const preview = firstUserMessage.content.slice(0, 30);
    return preview.length < firstUserMessage.content.length ? `${preview}...` : preview;
  }
  return 'New Conversation';
}

export function useConversationHistory() {
  const [store, setStore] = useState<ConversationStore>({
    sessions: {},
    activeSessionId: null,
    lastUpdated: new Date()
  });
  const [messages, setMessages] = useState<Message[]>([]);

  // Load conversations from localStorage on mount
  useEffect(() => {
    try {
      // Check for new format first
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null && 'sessions' in parsed) {
          const storeData = parsed as ConversationStore;
          // Convert date strings back to Date objects
          const processedStore: ConversationStore = {
            ...storeData,
            lastUpdated: new Date(storeData.lastUpdated),
            sessions: Object.fromEntries(
              Object.entries(storeData.sessions).map(([id, session]) => [
                id,
                {
                  ...session,
                  createdAt: new Date(session.createdAt),
                  updatedAt: new Date(session.updatedAt),
                  messages: session.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                  })),
                  galleryImages: (session.galleryImages || []).map(img => ({
                    ...img,
                    addedAt: new Date(img.addedAt)
                  }))
                }
              ])
            )
          };
          setStore(processedStore);
          
          // Set active session messages
          if (processedStore.activeSessionId && processedStore.sessions[processedStore.activeSessionId]) {
            const activeSession = processedStore.sessions[processedStore.activeSessionId];
            if (activeSession) {
              setMessages(activeSession.messages);
            }
          }
          return;
        }
      }
      
      // Check for legacy format and migrate
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        const parsed: unknown = JSON.parse(legacyStored);
        if (Array.isArray(parsed)) {
          const messagesWithDates = parsed.map((msg: unknown) => {
            if (typeof msg === 'object' && msg !== null && 'id' in msg && 'type' in msg && 'content' in msg && 'timestamp' in msg) {
              return {
                ...msg as Message,
                timestamp: new Date((msg as { timestamp: string }).timestamp)
              };
            }
            return null;
          }).filter((msg): msg is Message => msg !== null);
          
          // Create a session from legacy messages
          if (messagesWithDates.length > 0) {
            const sessionId = generateSessionId();
            const session: ConversationSession = {
              id: sessionId,
              title: generateSessionTitle(messagesWithDates),
              messages: messagesWithDates,
              galleryImages: [],
              createdAt: messagesWithDates[0]?.timestamp ?? new Date(),
              updatedAt: messagesWithDates[messagesWithDates.length - 1]?.timestamp ?? new Date()
            };
            
            const newStore: ConversationStore = {
              sessions: { [sessionId]: session },
              activeSessionId: sessionId,
              lastUpdated: new Date()
            };
            
            setStore(newStore);
            setMessages(messagesWithDates);
            
            // Remove legacy storage
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
    }
  }, []);

  // Save store to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn('Failed to save conversation store:', error);
    }
  }, [store]);

  const addMessage = useCallback((message: Message) => {
    setStore(prev => {
      let activeSessionId = prev.activeSessionId;
      
      // Create new session if none exists
      activeSessionId ??= generateSessionId();
      
      const currentSession = prev.sessions[activeSessionId];
      const updatedMessages = currentSession ? [...currentSession.messages, message] : [message];
      
      const updatedSession: ConversationSession = {
        id: activeSessionId,
        title: currentSession?.title ?? generateSessionTitle(updatedMessages),
        messages: updatedMessages,
        galleryImages: currentSession?.galleryImages ?? [],
        createdAt: currentSession?.createdAt ?? message.timestamp,
        updatedAt: message.timestamp
      };
      
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [activeSessionId]: updatedSession
        },
        activeSessionId,
        lastUpdated: new Date()
      };
    });
    
    setMessages(prev => [...prev, message]);
  }, []);

  const createNewSession = useCallback(() => {
    const sessionId = generateSessionId();
    setStore(prev => ({
      ...prev,
      activeSessionId: sessionId,
      lastUpdated: new Date()
    }));
    setMessages([]);
    return sessionId;
  }, []);
  
  const addGalleryImage = useCallback((image: GalleryImage) => {
    setStore(prev => {
      const activeSessionId = prev.activeSessionId;
      if (!activeSessionId) return prev;
      
      const currentSession = prev.sessions[activeSessionId];
      if (!currentSession) return prev;
      
      const updatedSession: ConversationSession = {
        ...currentSession,
        galleryImages: [...currentSession.galleryImages, image],
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [activeSessionId]: updatedSession
        },
        lastUpdated: new Date()
      };
    });
  }, []);
  
  const removeGalleryImage = useCallback((imageId: string) => {
    setStore(prev => {
      const activeSessionId = prev.activeSessionId;
      if (!activeSessionId) return prev;
      
      const currentSession = prev.sessions[activeSessionId];
      if (!currentSession) return prev;
      
      const updatedSession: ConversationSession = {
        ...currentSession,
        galleryImages: currentSession.galleryImages.filter(img => img.id !== imageId),
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [activeSessionId]: updatedSession
        },
        lastUpdated: new Date()
      };
    });
  }, []);
  
  const updateGalleryImageTitle = useCallback((imageId: string, title: string) => {
    setStore(prev => {
      const activeSessionId = prev.activeSessionId;
      if (!activeSessionId) return prev;
      
      const currentSession = prev.sessions[activeSessionId];
      if (!currentSession) return prev;
      
      const updatedSession: ConversationSession = {
        ...currentSession,
        galleryImages: currentSession.galleryImages.map(img => 
          img.id === imageId ? { ...img, title } : img
        ),
        updatedAt: new Date()
      };
      
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [activeSessionId]: updatedSession
        },
        lastUpdated: new Date()
      };
    });
  }, []);
  
  const switchToSession = useCallback((sessionId: string) => {
    setStore(prev => ({
      ...prev,
      activeSessionId: sessionId,
      lastUpdated: new Date()
    }));
    
    const session = store.sessions[sessionId];
    setMessages(session?.messages ?? []);
  }, [store.sessions]);
  
  const deleteSession = useCallback((sessionId: string) => {
    setStore(prev => {
      const newSessions = { ...prev.sessions };
      delete newSessions[sessionId];
      
      // If deleting active session, switch to another or create new
      let newActiveSessionId = prev.activeSessionId;
      if (prev.activeSessionId === sessionId) {
        const remainingSessions = Object.keys(newSessions);
        newActiveSessionId = remainingSessions.length > 0 ? remainingSessions[0] ?? null : null;
      }
      
      return {
        ...prev,
        sessions: newSessions,
        activeSessionId: newActiveSessionId,
        lastUpdated: new Date()
      };
    });
    
    // Update messages if we deleted the active session
    if (store.activeSessionId === sessionId) {
      const remainingSessions = Object.values(store.sessions).filter(s => s.id !== sessionId);
      setMessages(remainingSessions.length > 0 ? remainingSessions[0]?.messages ?? [] : []);
    }
  }, [store.activeSessionId, store.sessions]);
  
  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setStore(prev => {
      const session = prev.sessions[sessionId];
      if (!session) return prev;
      
      return {
        ...prev,
        sessions: {
          ...prev.sessions,
          [sessionId]: {
            ...session,
            title: newTitle,
            updatedAt: new Date()
          }
        },
        lastUpdated: new Date()
      };
    });
  }, []);
  
  const clearAllHistory = useCallback(() => {
    setStore({
      sessions: {},
      activeSessionId: null,
      lastUpdated: new Date()
    });
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear conversation history:', error);
    }
  }, []);

  const sessions = Object.values(store.sessions).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const activeSession = store.activeSessionId ? store.sessions[store.activeSessionId] : null;
  const galleryImages = activeSession?.galleryImages ?? [];
  
  return {
    messages,
    sessions,
    activeSessionId: store.activeSessionId,
    galleryImages,
    addMessage,
    createNewSession,
    switchToSession,
    deleteSession,
    renameSession,
    clearAllHistory,
    addGalleryImage,
    removeGalleryImage,
    updateGalleryImageTitle,
    setMessages
  };
}
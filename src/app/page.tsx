"use client";

import { useState, useRef, useEffect } from "react";
import { useConversationHistory } from "~/hooks/useConversationHistory";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { ImageGallery } from "~/components/ImageGallery";
import { ActionLogViewer } from "~/components/ActionLogViewer";
import { api } from "~/trpc/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, GalleryImage, ActionLog, ConversationPattern, MemoryInsight } from "~/types/conversation";

export default function Home() {
  const {
    messages,
    sessions,
    activeSessionId,
    galleryImages,
    addMessage,
    createNewSession,
    switchToSession,
    deleteSession,
    renameSession,
    clearAllHistory,
    addGalleryImage,
    removeGalleryImage
  } = useConversationHistory();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(true);
  const [imageCounter, setImageCounter] = useState(1);
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [currentActionLog, setCurrentActionLog] = useState<ActionLog | null>(null);
  const [currentPatterns, setCurrentPatterns] = useState<ConversationPattern[]>([]);
  const [currentInsights, setCurrentInsights] = useState<MemoryInsight | null>(null);
  const [workflowSuggestions, setWorkflowSuggestions] = useState<any[]>([]);
  const [conversationState, setConversationState] = useState<string>('beginning');
  const [nextBestActions, setNextBestActions] = useState<string[]>([]);
  
  // Load sidebar state from localStorage and handle responsive behavior
  useEffect(() => {
    try {
      const savedSidebarState = localStorage.getItem('awen-sidebar-open');
      if (savedSidebarState !== null) {
        const parsed: unknown = JSON.parse(savedSidebarState);
        if (typeof parsed === 'boolean') {
          setSidebarOpen(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load sidebar state:', error);
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setGalleryOpen(false);
      } else {
        setGalleryOpen(true);
      }
    };
    
    // Set initial state
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('awen-sidebar-open', JSON.stringify(sidebarOpen));
    } catch (error) {
      console.warn('Failed to save sidebar state:', error);
    }
  }, [sidebarOpen]);
  
  // Handle adding images to gallery from chat with duplicate prevention
  const addImageToGallery = (message: Message) => {
    if (message.isImage && message.content) {
      let imageContent = message.content;
      let isImagePrompt = false;
      
      // Check if it's an image prompt (contains the markdown format)
      if (message.content.includes('**Image Prompt:**') || message.intent === 'image_prompt') {
        isImagePrompt = true;
        // Keep the original prompt content for image prompts
      } else if (!message.content.startsWith('http')) {
        // If it's a legacy placeholder, convert to Picsum URL
        const randomSeed = Math.floor(Math.random() * 1000);
        imageContent = `https://picsum.photos/400/300?random=${randomSeed}`;
      }
      
      // Check for duplicates
      const isDuplicate = galleryImages.some(img => img.content === imageContent);
      if (isDuplicate) {
        return; // Don't add duplicate
      }
      
      const imageNumber = galleryImages.length + 1;
      const galleryImage: GalleryImage = {
        id: `gallery_${Date.now()}`,
        content: imageContent,
        title: isImagePrompt ? `Image Prompt ${imageNumber}` : `Chat Image ${imageNumber}`,
        addedAt: new Date(),
        sourceMessageId: message.id
      };
      addGalleryImage(galleryImage);
    }
  };
  
  // Function to create a new image message to replace legacy placeholder
  const createImageFromLegacy = (originalMessage: Message) => {
    if (originalMessage.isImage && !originalMessage.content.startsWith('http')) {
      const randomSeed = parseInt(originalMessage.id) % 1000; // Use message ID for consistent seed
      const imageUrl = `https://picsum.photos/400/300?random=${randomSeed}`;
      
      // Create a new AI message with the actual image
      const newImageMessage: Message = {
        id: `upgraded_${Date.now()}`,
        type: "assistant" as const,
        content: imageUrl,
        timestamp: new Date(),
        isImage: true,
      };
      
      addMessage(newImageMessage);
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Remove mock function - will use real AI API

  const processMessageMutation = api.ai.processMessage.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const result = await processMessageMutation.mutateAsync({
        content: userMessage.content,
        sessionId: activeSessionId ?? 'default',
        conversationHistory: messages,
      });

      // Add the AI response message
      addMessage(result.message);
      
      // Store action log and insights for transparency
      if (result.actionLog) {
        setCurrentActionLog(result.actionLog);
        setActionLogVisible(true);
        // Note: Removed auto-hide - user must manually close
      }
      
      if (result.patterns) {
        setCurrentPatterns(result.patterns);
      }
      
      if (result.memoryInsights) {
        setCurrentInsights(result.memoryInsights);
      }
      
      if (result.workflowSuggestions) {
        setWorkflowSuggestions(result.workflowSuggestions);
      }
      
      if (result.conversationState) {
        setConversationState(result.conversationState);
      }
      
      if (result.nextBestActions) {
        setNextBestActions(result.nextBestActions);
      }
      
      // Note: Images are no longer automatically added to gallery
      // They will be added when user clicks on them

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to process message:', error);
      
      // Fallback response
      const fallbackMessage: Message = {
        id: `fallback_${Date.now()}`,
        type: "assistant",
        content: "I apologize, but I'm having trouble processing your request right now. Please try again.",
        timestamp: new Date(),
        confidence: 0.1,
      };
      
      addMessage(fallbackMessage);
      setIsLoading(false);
    }
  };


  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-white">
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onCreateNew={createNewSession}
        onSwitchSession={switchToSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onClearAll={clearAllHistory}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex flex-1 flex-col">
        <header className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-md hover:bg-gray-100"
                title="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Awen</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setGalleryOpen(!galleryOpen)}
                className="p-2 rounded-md hover:bg-gray-100 text-purple-600"
                title="Toggle gallery"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={createNewSession}
                className="hidden sm:flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.172-.247l-7.464 1.326.75-3.536A8.942 8.942 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">How can I help you today?</h2>
                <p className="text-gray-600">Start a conversation with me. I can provide text responses or generate images.</p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-xs lg:max-w-2xl ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 ${message.type === 'user' ? 'ml-3' : 'mr-3'}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {message.type === 'user' ? 'U' : 'AI'}
                    </div>
                  </div>
                  <div className={`rounded-lg px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {message.isImage ? (
                      <div className="relative group">
                        {message.content.startsWith('http') ? (
                          <div className="relative group cursor-pointer">
                            <img 
                              src={message.content} 
                              alt="AI generated" 
                              className="rounded-lg max-w-full h-auto shadow-md transition-all duration-300 group-hover:shadow-xl"
                              onError={(e) => {
                                // Try alternative image service if Picsum fails
                                const target = e.target as HTMLImageElement;
                                if (!target.src.includes('placehold.co')) {
                                  const dimensions = '400x300';
                                  const randomColor = Math.floor(Math.random()*16777215).toString(16);
                                  target.src = `https://placehold.co/${dimensions}/${randomColor}/white?text=Generated+Image`;
                                } else {
                                  // If both services fail, show fallback
                                  target.style.display = 'none';
                                  const placeholder = target.parentElement?.querySelector('.image-fallback') as HTMLElement | null;
                                  if (placeholder) placeholder.style.display = 'block';
                                }
                              }}
                            />
                            <div className="image-fallback hidden bg-gray-200 rounded-lg p-6 text-center text-gray-600 border-2 border-dashed border-gray-300">
                              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm font-medium">Image failed to load</p>
                              <p className="text-xs text-gray-500 mt-1">Placeholder service unavailable</p>
                            </div>
                            {/* Subtle overlay that appears on hover */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg flex items-center justify-center">
                              <button
                                onClick={() => addImageToGallery(message)}
                                className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out px-4 py-2 text-sm bg-white/90 backdrop-blur-sm text-gray-800 rounded-full hover:bg-white hover:scale-105 flex items-center space-x-2 shadow-lg border border-white/20"
                                title="Add to gallery for AI context"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="font-medium">Add to Gallery</span>
                              </button>
                            </div>
                          </div>
                        ) : (message.content.includes('**Image Prompt:**') || message.intent === 'image_prompt') ? (
                          // AI-generated image prompt
                          <div className="relative group cursor-pointer">
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200 transition-all duration-300 group-hover:shadow-xl">
                              <div className="flex items-center mb-3">
                                <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-semibold text-purple-800">AI-Generated Image Prompt</span>
                              </div>
                              <div className="text-sm prose prose-sm max-w-none">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({children}) => <p className="mb-2 last:mb-0 text-gray-700">{children}</p>,
                                    strong: ({children}) => <strong className="font-semibold text-purple-800">{children}</strong>,
                                    em: ({children}) => <em className="italic text-gray-600">{children}</em>,
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                              <div className="mt-3 pt-3 border-t border-purple-200">
                                <p className="text-xs text-purple-600 italic">
                                  💡 This prompt can be used with image generation tools like DALL-E, Midjourney, or Stable Diffusion
                                </p>
                              </div>
                            </div>
                            {/* Hover overlay with centered button */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-lg flex items-center justify-center">
                              <button
                                onClick={() => addImageToGallery(message)}
                                className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out px-4 py-2 text-sm bg-white/90 backdrop-blur-sm text-gray-800 rounded-full hover:bg-white hover:scale-105 flex items-center space-x-2 shadow-lg border border-white/20"
                                title="Add image prompt to gallery"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="font-medium">Add to Gallery</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Legacy placeholder format for old messages
                          <div className="bg-gray-200 rounded-lg p-6 text-center text-gray-600 border-2 border-dashed border-gray-300">
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm font-medium">{message.content}</p>
                            <p className="text-xs text-gray-500 mt-1">Legacy image placeholder</p>
                            <div className="mt-3 space-y-2">
                              <button
                                onClick={() => createImageFromLegacy(message)}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors flex items-center space-x-1 mx-auto"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Generate Image</span>
                              </button>
                              <button
                                onClick={() => addImageToGallery(message)}
                                className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors flex items-center space-x-1 mx-auto"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Add to Gallery</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm prose prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Custom styling for markdown elements
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                            code: ({children, ...props}) => {
                              const hasClassName = 'className' in props && props.className;
                              return !hasClassName 
                                ? <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                : <pre className="bg-gray-100 p-2 rounded-md overflow-x-auto"><code className="text-xs font-mono">{children}</code></pre>;
                            },
                            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({children}) => <li className="text-sm">{children}</li>,
                            h1: ({children}) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                            blockquote: ({children}) => <blockquote className="border-l-2 border-gray-300 pl-2 italic">{children}</blockquote>,
                            strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                            em: ({children}) => <em className="italic">{children}</em>,
                            a: ({href, children}) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    <p className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-xs lg:max-w-2xl">
                  <div className="flex-shrink-0 mr-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
                      AI
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-4 py-4">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-end space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <ImageGallery
        images={galleryImages}
        onAddImage={addGalleryImage}
        onRemoveImage={removeGalleryImage}
        isOpen={galleryOpen}
        onToggle={() => setGalleryOpen(!galleryOpen)}
      />
      
      {/* Action Log Viewer - Shows AI reasoning transparency */}
      <ActionLogViewer
        actionLog={currentActionLog}
        patterns={currentPatterns}
        insights={currentInsights}
        workflowSuggestions={workflowSuggestions}
        conversationState={conversationState}
        nextBestActions={nextBestActions}
        isVisible={actionLogVisible}
        onToggle={() => setActionLogVisible(!actionLogVisible)}
        onSuggestionClick={(suggestion) => {
          // Auto-fill the input with the suggested prompt
          setInput(suggestion.prompt);
          setActionLogVisible(false);
        }}
      />
    </div>
  );
}

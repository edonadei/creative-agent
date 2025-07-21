"use client";

import { useState } from 'react';
import type { ConversationSession } from '~/types/conversation';

interface ConversationSidebarProps {
  sessions: ConversationSession[];
  activeSessionId: string | null;
  onCreateNew: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ConversationSidebar({
  sessions,
  activeSessionId,
  onCreateNew,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
  onClearAll,
  isOpen,
  onToggle
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleStartEdit = (session: ConversationSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <>
      {/* Mobile backdrop - only show on mobile when sidebar is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        h-full bg-gray-50 border-r border-gray-200 transform transition-all duration-500 ease-in-out shadow-xl
        ${isOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full'}
        lg:relative lg:shadow-none
        fixed lg:static left-0 top-0 z-50 lg:z-auto overflow-hidden
      `}>
        <div className="flex flex-col h-full w-80 min-w-80">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={onCreateNew}
              className="w-full mt-3 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`
                      group relative rounded-lg p-3 cursor-pointer transition-colors
                      ${session.id === activeSessionId 
                        ? 'bg-blue-100 border-blue-200 border' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                    onClick={() => session.id !== activeSessionId && onSwitchSession(session.id)}
                  >
                    {editingId === session.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {session.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {session.messages.length} message{session.messages.length !== 1 ? 's' : ''} • {formatDate(session.updatedAt)}
                            </p>
                          </div>
                          
                          {/* Actions menu */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(session);
                                }}
                                className="p-1 rounded hover:bg-gray-200"
                                title="Rename"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this conversation?')) {
                                    onDeleteSession(session.id);
                                  }
                                }}
                                className="p-1 rounded hover:bg-red-100 text-red-600"
                                title="Delete"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {sessions.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  if (confirm('Clear all conversation history?')) {
                    onClearAll();
                  }
                }}
                className="w-full text-sm text-red-600 hover:text-red-800 py-2"
              >
                Clear All Conversations
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
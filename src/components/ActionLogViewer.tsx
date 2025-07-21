"use client";

import { useState } from 'react';
import type { ActionLog, ConversationPattern, MemoryInsight } from '~/types/conversation';

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

interface ActionLogViewerProps {
  actionLog: ActionLog | null;
  patterns?: ConversationPattern[];
  insights?: MemoryInsight | null;
  workflowSuggestions?: WorkflowSuggestion[];
  conversationState?: string;
  nextBestActions?: string[];
  isVisible: boolean;
  onToggle: () => void;
  onSuggestionClick?: (suggestion: WorkflowSuggestion) => void;
}

export function ActionLogViewer({ 
  actionLog, 
  patterns, 
  insights, 
  workflowSuggestions,
  conversationState,
  nextBestActions,
  isVisible, 
  onToggle,
  onSuggestionClick
}: ActionLogViewerProps) {
  const [activeTab, setActiveTab] = useState<'reasoning' | 'patterns' | 'optimization' | 'workflow'>('reasoning');

  if (!actionLog) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'text':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.172-.247l-7.464 1.326.75-3.536A8.942 8.942 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
          </svg>
        );
      case 'image':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'contextual_reasoning':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className={`
      fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 transform transition-all duration-300
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg border-b">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-full bg-blue-100 text-blue-600`}>
            {getActionIcon(actionLog.action)}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-900">AI Reasoning</h3>
            <p className="text-xs text-gray-500">{formatTime(actionLog.timestamp)}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {['reasoning', 'patterns', 'optimization', 'workflow'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-2 px-3 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === 'reasoning' && (
          <div className="space-y-3">
            {/* Action Summary */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Action: {actionLog.action}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(actionLog.confidence)}`}>
                  {Math.round(actionLog.confidence * 100)}%
                </span>
              </div>
              <div className="text-xs text-gray-600">
                <p><strong>Model:</strong> {actionLog.modelUsed}</p>
                <p><strong>Time:</strong> {actionLog.processingTime}ms</p>
              </div>
            </div>

            {/* Reasoning Chain */}
            {actionLog.reasoningChain && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Reasoning Steps</h4>
                <div className="space-y-1">
                  {actionLog.reasoningChain.map((step, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-xs text-blue-600 font-mono mt-0.5">{index + 1}.</span>
                      <span className="text-xs text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contextual Reasoning */}
            {actionLog.contextualReasoning && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Contextual Analysis</h4>
                <div className="bg-purple-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-gray-700">
                    <strong>Intent:</strong> {actionLog.contextualReasoning.userIntent}
                  </p>
                  <p className="text-xs text-gray-700">
                    <strong>Flow:</strong> {actionLog.contextualReasoning.conversationFlow}
                  </p>
                  <p className="text-xs text-gray-700">
                    <strong>Reasoning:</strong> {actionLog.contextualReasoning.reasoning}
                  </p>
                  {actionLog.contextualReasoning.hypotheticalNext.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-900">Predicted Next Actions:</p>
                      <ul className="text-xs text-gray-600 mt-1">
                        {actionLog.contextualReasoning.hypotheticalNext.map((action, i) => (
                          <li key={i} className="ml-2">• {action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-3">
            {patterns && patterns.length > 0 ? (
              patterns.slice(0, 5).map((pattern, index) => (
                <div key={pattern.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-900 capitalize">
                      {pattern.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getConfidenceColor(pattern.confidence)}`}>
                      {Math.round(pattern.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{pattern.pattern}</p>
                  <p className="text-xs text-gray-500">
                    Seen {pattern.occurrences} times • Last: {pattern.lastSeen.toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">No patterns detected yet</p>
            )}

            {insights && (
              <div className="bg-blue-50 rounded-lg p-3 mt-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Current Insights</h4>
                <p className="text-xs text-gray-700 mb-1">
                  <strong>Style:</strong> {insights.communicationStyle}
                </p>
                <p className="text-xs text-gray-700 mb-1">
                  <strong>Context:</strong> {insights.sessionContext}
                </p>
                {insights.topicInterests.length > 0 && (
                  <p className="text-xs text-gray-700">
                    <strong>Interests:</strong> {insights.topicInterests.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'optimization' && actionLog.optimization && (
          <div className="space-y-3">
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Token Optimization</h4>
              <div className="space-y-1 text-xs text-gray-700">
                <p><strong>Strategy:</strong> {actionLog.optimization.strategy}</p>
                <p><strong>Tokens Saved:</strong> {actionLog.optimization.tokensSaved}</p>
                <p><strong>Estimated Cost:</strong> ${actionLog.optimization.estimatedCost.toFixed(6)}</p>
                <p><strong>Reasoning:</strong> {actionLog.optimization.reasoning}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Performance Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-600">Processing Time</p>
                  <p className="font-medium text-gray-900">{actionLog.processingTime}ms</p>
                </div>
                <div>
                  <p className="text-gray-600">Model Used</p>
                  <p className="font-medium text-gray-900">{actionLog.modelUsed.includes('lite') ? 'Flash Lite' : 'Flash'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Confidence</p>
                  <p className="font-medium text-gray-900">{Math.round(actionLog.confidence * 100)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Action Type</p>
                  <p className="font-medium text-gray-900 capitalize">{actionLog.action}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-3">
            {/* Conversation State */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Conversation State</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  conversationState === 'beginning' ? 'bg-green-100 text-green-800' :
                  conversationState === 'developing' ? 'bg-blue-100 text-blue-800' :
                  conversationState === 'deep_dive' ? 'bg-purple-100 text-purple-800' :
                  conversationState === 'conclusion' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {conversationState}
                </span>
              </div>
            </div>

            {/* Next Best Actions */}
            {nextBestActions && nextBestActions.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Next Best Actions</h4>
                <ul className="space-y-1">
                  {nextBestActions.map((action, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start">
                      <span className="text-blue-600 mr-1">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Workflow Suggestions */}
            {workflowSuggestions && workflowSuggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Suggested Next Steps</h4>
                <div className="space-y-2">
                  {workflowSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onSuggestionClick?.(suggestion)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h5 className="text-sm font-medium text-gray-900">{suggestion.title}</h5>
                        <div className="flex items-center space-x-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                            suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {suggestion.priority}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{suggestion.description}</p>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          suggestion.type === 'next_step' ? 'bg-green-100 text-green-800' :
                          suggestion.type === 'follow_up' ? 'bg-blue-100 text-blue-800' :
                          suggestion.type === 'exploration' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {suggestion.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{suggestion.reasoning}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!workflowSuggestions || workflowSuggestions.length === 0) && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No workflow suggestions available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 rounded-b-lg border-t">
        <p className="text-xs text-gray-500 text-center">
          AI reasoning transparency • {actionLog.reasoningChain?.length || 0} steps
        </p>
      </div>
    </div>
  );
}
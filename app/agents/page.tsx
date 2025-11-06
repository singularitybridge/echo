/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Folder, FileText, ArrowLeft } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'folder' | 'file';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (!response.ok) {
          console.error('Failed to load agents');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setAgents(data.agents || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load agents:', err);
        setLoading(false);
      }
    };

    loadAgents();
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
          <p className="text-gray-600 text-sm">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - AssetLibrary Style */}
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Stories
              </button>
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-semibold text-gray-900">AI Agents</h1>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2 ml-[4.5rem]">
            Browse all AI agents powering Echo
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {agents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No agents found
            </h2>
            <p className="text-gray-600">
              No agents are available in the .agents folder.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg flex-shrink-0">
                      {agent.type === 'folder' ? (
                        <Folder className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <FileText className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {agent.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          .agents/{agent.path}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Agent Count */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

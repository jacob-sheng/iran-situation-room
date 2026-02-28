import React, { useState } from 'react';
import { LLMSettings } from '../types';
import { X, Settings, Save, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
  onClose: () => void;
}

export default function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<LLMSettings>(settings);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localSettings);
    onClose();
  };

  const fetchModels = async () => {
    if (!localSettings.endpoint || !localSettings.apiKey) {
      setModelError('Please enter endpoint and API key first.');
      return;
    }
    setLoadingModels(true);
    setModelError('');
    try {
      const res = await fetch(`${localSettings.endpoint.replace(/\/$/, '')}/models`, {
        headers: { 'Authorization': `Bearer ${localSettings.apiKey}` }
      });
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        setModels(data.data.map((m: any) => m.id));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (e: any) {
      setModelError(e.message || 'Error fetching models');
    } finally {
      setLoadingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Settings size={18} />
            <h2 className="font-semibold">OpenAPI Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              API Endpoint (Base URL)
            </label>
            <input
              type="url"
              required
              value={localSettings.endpoint}
              onChange={(e) => setLocalSettings(s => ({ ...s, endpoint: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              required
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings(s => ({ ...s, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Model
              </label>
              <button 
                type="button" 
                onClick={fetchModels}
                disabled={loadingModels}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
                Fetch Models
              </button>
            </div>
            <input
              type="text"
              required
              list="models-list"
              value={localSettings.model}
              onChange={(e) => setLocalSettings(s => ({ ...s, model: e.target.value }))}
              placeholder="gpt-3.5-turbo"
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <datalist id="models-list">
              {models.map(m => <option key={m} value={m} />)}
            </datalist>
            {modelError && <p className="text-xs text-rose-500 mt-1">{modelError}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Save size={16} />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

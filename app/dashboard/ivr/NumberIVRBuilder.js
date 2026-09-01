'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import IVRFlowBuilder from '../components/IVRFlowBuilder';

export default function NumberIVRBuilder({ numberData, onSaved }) {
  const [enabled, setEnabled] = useState(numberData.play_ivr_greeting ?? true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Default config if none exists
  const [config, setConfig] = useState({
    greeting: numberData.ivr_greeting || 'Thank you for calling our office. Please listen to the following menu options.',
    flow: {}
  });
  const [teammates, setTeammates] = useState([]);

  useEffect(() => {
    async function loadData() {
      const initialConfig = numberData.ivr_flow_config;
      if (initialConfig && Object.keys(initialConfig).length > 0) {
        setConfig({
          greeting: initialConfig.greeting || config.greeting,
          flow: initialConfig.flow || {}
        });
      } else {
        setConfig({
          greeting: numberData.ivr_greeting || config.greeting,
          flow: {}
        });
      }

      const { data: teamData } = await supabase
        .from('contacts')
        .select('id, name, phone, custom_fields')
        .eq('organization_id', numberData.organization_id)
        .order('name');
      if (teamData) setTeammates(teamData.filter(t => t.custom_fields && t.custom_fields.role && t.custom_fields.role !== 'Seller'));

      setLoading(false);
    }
    loadData();
  }, [numberData]);

  const saveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('organization_numbers')
        .update({ 
          ivr_flow_config: config,
          play_ivr_greeting: enabled,
          ivr_greeting: config.greeting
        })
        .eq('id', numberData.id);
        
      if (!error) {
        onSaved('IVR Workflow saved successfully!');
      } else {
        alert('Failed to save IVR config.');
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-slate-400">Loading IVR Builder...</div>;

  return (
    <div className="glass-card rounded-2xl p-8 max-w-4xl border border-indigo-500/30 bg-slate-900/60">
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="text-2xl mr-2">🔀</span> IVR Builder for {numberData.phone_number}
          </h2>
          <p className="text-slate-400 mt-1">Design your custom call routing workflow visually for this number.</p>
        </div>
        <div className="flex items-center space-x-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700">
          <span className={`text-sm font-medium ${enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <button 
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
              enabled ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className={`transition-opacity duration-300 ${!enabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        <form onSubmit={saveConfig} className="space-y-8">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">
              Main Greeting Message
            </label>
            <textarea
              required
              rows={3}
              value={config.greeting}
              onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              placeholder="e.g. Welcome to Prime Real Estate. To connect with a receptionist, press 1..."
            />
            <p className="text-xs text-slate-500 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              This is the first message the caller will hear. It should explain the keypad options you configure below.
            </p>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="block text-sm font-medium text-slate-300 mb-4">
              Routing Workflow
            </label>
            <div className="bg-slate-950/50 rounded-xl border border-slate-700 p-2 sm:p-4 overflow-x-auto">
              <div className="min-w-[600px]">
                <IVRFlowBuilder 
                  flow={config.flow || {}} 
                  onChange={(newFlow) => setConfig({ ...config, flow: newFlow })}
                  teammates={teammates}
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Workflow'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

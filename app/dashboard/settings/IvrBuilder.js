'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import IVRFlowBuilder from '../../components/IVRFlowBuilder';

export default function IvrBuilder({ orgId, initialConfig, initialEnabled, onSaved }) {
  const [enabled, setEnabled] = useState(initialEnabled ?? true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Default config if none exists
  const [config, setConfig] = useState({
    greeting: 'Thank you for calling our office. Please listen to the following menu options.',
    flow: {}
  });
  const [teammates, setTeammates] = useState([]);

  useEffect(() => {
    async function loadData() {
      if (initialConfig && Object.keys(initialConfig).length > 0) {
        // Migration from old flat config to new tree config
        if (initialConfig.keyPress && !initialConfig.flow) {
          setConfig({
            greeting: initialConfig.greeting,
            flow: Object.keys(initialConfig.keyPress).reduce((acc, key) => {
              const old = initialConfig.keyPress[key];
              let newAction = 'ring_team';
              if (old.action === 'route_number') newAction = 'forward_call';
              if (old.action === 'voicemail') newAction = 'voicemail';
              acc[key] = { action: newAction, duration: old.timeout || 20 };
              if (newAction === 'forward_call') acc[key].phoneNumber = old.number || '';
              if (newAction === 'ring_team') acc[key].teamRole = 'Sales'; // default mapping
              return acc;
            }, {})
          });
        } else {
          setConfig({
            greeting: initialConfig.greeting || config.greeting,
            flow: initialConfig.flow || {}
          });
        }
      }

      const { data: teamData } = await supabase
        .from('contacts')
        .select('id, name, phone, custom_fields')
        .eq('organization_id', orgId)
        .order('name');
      if (teamData) setTeammates(teamData.filter(t => t.custom_fields && t.custom_fields.role));

      setLoading(false);
    }
    loadData();
  }, [orgId, initialConfig]);

  const saveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ 
          ivr_flow_config: config,
          play_ivr_greeting: enabled
        })
        .eq('id', orgId);
        
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
            <span className="text-2xl mr-2">🔀</span> Dynamic IVR Builder
          </h2>
          <p className="text-slate-400 mt-1">Design your custom call routing workflow visually, with unlimited nesting.</p>
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
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      <form onSubmit={saveConfig} className={`space-y-8 transition-opacity duration-300 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
        
        {/* Step 1: Greeting */}
        <div className="relative border-l-2 border-indigo-500 pl-6 pb-6">
          <div className="absolute -left-3.5 top-0 bg-indigo-500 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(99,102,241,0.5)]">1</div>
          <h3 className="text-lg font-bold text-white mb-2">Main Greeting</h3>
          <p className="text-sm text-slate-400 mb-4">This message plays immediately when someone calls.</p>
          <textarea
            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
            value={config.greeting || ''}
            onChange={(e) => setConfig({...config, greeting: e.target.value})}
            placeholder="Thank you for calling..."
            required
          />
        </div>

        {/* Step 2: Flow Builder */}
        <div className="relative border-l-2 border-indigo-500 pl-6">
          <div className="absolute -left-3.5 top-0 bg-indigo-500 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(99,102,241,0.5)]">2</div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">Call Routing Flow</h3>
            <p className="text-sm text-slate-400">Define what happens when callers press numbers on their keypad.</p>
          </div>

          <IVRFlowBuilder 
            value={config.flow} 
            onChange={(newFlow) => setConfig({...config, flow: newFlow})}
            teammates={teammates}
          />
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-end pointer-events-auto">
          <button 
            type="submit" 
            disabled={saving} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save IVR Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function IvrBuilder({ orgId, initialConfig, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  
  // Default config if none exists
  const [config, setConfig] = useState({
    greeting: 'Thank you for calling our office. Please listen to the following menu options.',
    keyPress: {
      '1': { action: 'route_browser' },
      '2': { action: 'property_lookup' }
    }
  });

  useEffect(() => {
    async function loadData() {
      if (initialConfig && Object.keys(initialConfig).length > 0) {
        setConfig(initialConfig);
      }
      
      if (orgId) {
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, name, cell_phone')
          .eq('organization_id', orgId)
          .order('name');
          
        if (agentsData) {
          setAgents(agentsData);
        }
      }
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
        .update({ ivr_flow_config: config })
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

  const addKeypress = () => {
    // Find next available digit (0-9)
    for (let i = 1; i <= 9; i++) {
      if (!config.keyPress[i.toString()]) {
        setConfig({
          ...config,
          keyPress: {
            ...config.keyPress,
            [i.toString()]: { action: 'route_browser' }
          }
        });
        return;
      }
    }
    alert("You've reached the maximum number of keypress options.");
  };

  const updateKeypress = (key, data) => {
    setConfig({
      ...config,
      keyPress: {
        ...config.keyPress,
        [key]: data
      }
    });
  };

  const removeKeypress = (key) => {
    const newKeys = { ...config.keyPress };
    delete newKeys[key];
    setConfig({ ...config, keyPress: newKeys });
  };

  if (loading) return <div className="p-8 text-slate-400">Loading IVR Builder...</div>;

  return (
    <div className="glass-card rounded-2xl p-8 max-w-4xl border border-indigo-500/30 bg-slate-900/60">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="text-2xl mr-2">🔀</span> Dynamic IVR Builder
          </h2>
          <p className="text-slate-400 mt-1">Design your custom call routing workflow visually.</p>
        </div>
      </div>

      <form onSubmit={saveConfig} className="space-y-8">
        
        {/* Step 1: Greeting */}
        <div className="relative border-l-2 border-indigo-500 pl-6 pb-6">
          <div className="absolute -left-3.5 top-0 bg-indigo-500 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(99,102,241,0.5)]">1</div>
          <h3 className="text-lg font-bold text-white mb-2">Main Greeting</h3>
          <p className="text-sm text-slate-400 mb-4">This message plays immediately when someone calls.</p>
          <textarea
            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
            value={config.greeting}
            onChange={(e) => setConfig({...config, greeting: e.target.value})}
            placeholder="Thank you for calling..."
            required
          />
        </div>

        {/* Step 2: Keypress Routing */}
        <div className="relative border-l-2 border-indigo-500 pl-6">
          <div className="absolute -left-3.5 top-0 bg-indigo-500 text-white font-bold rounded-full h-7 w-7 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(99,102,241,0.5)]">2</div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Keypress Menu</h3>
              <p className="text-sm text-slate-400">Define what happens when callers press numbers on their keypad.</p>
            </div>
            <button 
              type="button" 
              onClick={addKeypress}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-white/10"
            >
              + Add Branch
            </button>
          </div>

          <div className="space-y-4">
            {Object.entries(config.keyPress).sort(([a], [b]) => Number(a) - Number(b)).map(([digit, route]) => (
              <div key={digit} className="bg-slate-950/50 border border-slate-700/50 rounded-xl p-4 flex gap-4 items-start relative group transition-colors hover:border-indigo-500/50">
                <div className="bg-indigo-500/20 text-indigo-300 font-mono font-bold rounded-lg h-12 w-12 flex items-center justify-center text-xl shrink-0 border border-indigo-500/30">
                  {digit}
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Action</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                      value={route.action}
                      onChange={(e) => {
                        const newAction = e.target.value;
                        const defaultData = { action: newAction };
                        if (newAction === 'route_agent' && agents.length > 0) defaultData.agentId = agents[0].id;
                        updateKeypress(digit, defaultData);
                      }}
                    >
                      <option value="route_browser">Ring Web Dialer (Office)</option>
                      <option value="route_agent">Forward to Agent</option>
                      <option value="route_number">Forward to External Number</option>
                      <option value="property_lookup">Property / Listing Lookup (Press 2)</option>
                      <option value="voicemail">Send directly to Voicemail</option>
                    </select>
                  </div>

                  {route.action === 'route_agent' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Agent</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        value={route.agentId || ''}
                        onChange={(e) => updateKeypress(digit, { ...route, agentId: e.target.value })}
                        required
                      >
                        {agents.length === 0 ? <option value="">No agents found...</option> : null}
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.cell_phone})</option>)}
                      </select>
                    </div>
                  )}

                  {route.action === 'route_number' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                      <input
                        type="tel"
                        required
                        placeholder="+1 555 123 4567"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        value={route.number || ''}
                        onChange={(e) => updateKeypress(digit, { ...route, number: e.target.value })}
                      />
                    </div>
                  )}
                  
                  {['route_agent', 'route_number', 'route_browser'].includes(route.action) && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Ring Timeout (Seconds)</label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                        value={route.timeout || 15}
                        onChange={(e) => updateKeypress(digit, { ...route, timeout: parseInt(e.target.value) || 15 })}
                        title="Time to ring before falling back to voicemail"
                      />
                    </div>
                  )}
                  
                  {route.action === 'property_lookup' && (
                    <div className="flex items-center">
                      <span className="text-sm text-slate-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 w-full text-center">
                        Automatically looks up active properties via ZIP code.
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeKeypress(digit)}
                  className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
                  title="Remove Option"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </button>
              </div>
            ))}
            
            {Object.keys(config.keyPress).length === 0 && (
              <div className="text-center p-6 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm">
                No keypress options defined. Callers will hear the greeting and then the call will hang up.
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-end">
          <button 
            type="submit" 
            disabled={saving} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            {saving ? 'Deploying Workflow...' : 'Save IVR Workflow'}
          </button>
        </div>

      </form>
    </div>
  );
}

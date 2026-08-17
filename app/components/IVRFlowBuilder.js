'use client';
import { useState } from 'react';

// IVRFlowBuilder component for creating nested call flows
export default function IVRFlowBuilder({ value, onChange, teammates = [] }) {
  // Ensure value is an object
  const flow = value || {};

  const handleUpdate = (key, nodeData) => {
    const newFlow = { ...flow };
    if (nodeData === null) {
      delete newFlow[key];
    } else {
      newFlow[key] = nodeData;
    }
    onChange(newFlow);
  };

  const addKey = () => {
    // find next available digit 1-9
    for (let i = 1; i <= 9; i++) {
      if (!flow[String(i)]) {
        handleUpdate(String(i), { action: 'ring_team', teamRole: 'Sales', duration: 20 });
        return;
      }
    }
    alert('Maximum 9 options allowed per menu.');
  };

  return (
    <div className="space-y-4">
      {Object.keys(flow).sort().map((key) => (
        <IVRNode 
          key={key} 
          digit={key} 
          node={flow[key]} 
          onUpdate={(nodeData) => handleUpdate(key, nodeData)} 
          isRoot={true}
          teammates={teammates}
        />
      ))}

      {Object.keys(flow).length < 9 && (
        <button 
          type="button" 
          onClick={addKey}
          className="w-full border-2 border-dashed border-white/20 hover:border-indigo-500/50 rounded-xl p-4 text-slate-400 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <span>+ Add Key Option</span>
        </button>
      )}
    </div>
  );
}

function IVRNode({ digit, node, onUpdate, isRoot = false, teammates = [] }) {
  const updateField = (field, val) => {
    onUpdate({ ...node, [field]: val });
  };

  const setAction = (actionType) => {
    const base = { action: actionType };
    if (actionType === 'ring_team') {
      base.teamRole = 'Sales';
      base.duration = 20;
    } else if (actionType === 'route_agent') {
      base.agentId = teammates.length > 0 ? teammates[0].id : '';
      base.duration = 20;
    } else if (actionType === 'forward_call') {
      base.phoneNumber = '';
      base.duration = 20;
    } else if (actionType === 'sub_menu') {
      base.greeting = 'Please listen carefully to the following options...';
      base.options = { '1': { action: 'ring_team', teamRole: 'Support', duration: 20 } };
    }
    // Keep fallback if it exists and action isn't sub_menu or voicemail
    if (node.fallback && actionType !== 'sub_menu' && actionType !== 'voicemail') {
      base.fallback = node.fallback;
    }
    onUpdate(base);
  };

  const addFallback = () => {
    onUpdate({ ...node, fallback: { action: 'voicemail' } });
  };

  const removeFallback = () => {
    const newNode = { ...node };
    delete newNode.fallback;
    onUpdate(newNode);
  };

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5 shadow-lg relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center border border-indigo-500/30">
            {digit}
          </div>
          <div>
            <h3 className="font-medium text-white text-sm">If caller presses {digit}</h3>
          </div>
        </div>
        <button 
          type="button" 
          onClick={() => onUpdate(null)} 
          className="text-slate-500 hover:text-red-400 text-sm"
        >
          Remove
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={node.action} 
            onChange={(e) => setAction(e.target.value)}
            className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm flex-1"
          >
            <option value="ring_team">Ring Team Role</option>
            <option value="route_agent">Forward to Team Member</option>
            <option value="forward_call">Forward to Phone Number</option>
            <option value="sub_menu">Sub-Menu (More Options)</option>
            <option value="voicemail">Send to Voicemail</option>
          </select>

          {node.action === 'ring_team' && (
            <>
              <input 
                type="text" 
                placeholder="Role (e.g. Sales, Support)" 
                value={node.teamRole || ''} 
                onChange={(e) => updateField('teamRole', e.target.value)}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm flex-1"
              />
              <input 
                type="number" 
                placeholder="Seconds" 
                value={node.duration || ''} 
                onChange={(e) => updateField('duration', parseInt(e.target.value))}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm w-24"
              />
            </>
          )}

          {node.action === 'forward_call' && (
            <>
              <input 
                type="tel" 
                placeholder="+1234567890" 
                value={node.phoneNumber || ''} 
                onChange={(e) => updateField('phoneNumber', e.target.value)}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm flex-1"
              />
              <input 
                type="number" 
                placeholder="Seconds" 
                value={node.duration || ''} 
                onChange={(e) => updateField('duration', parseInt(e.target.value))}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm w-24"
              />
            </>
          )}

          {node.action === 'route_agent' && (
            <>
              <select 
                value={node.agentId || ''} 
                onChange={(e) => updateField('agentId', e.target.value)}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm flex-1"
              >
                <option value="">Select Team Member...</option>
                {teammates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.phone || 'No phone'})</option>
                ))}
              </select>
              {teammates.length === 0 && (
                <div className="text-red-400 text-xs mt-1 absolute -bottom-5">No team members available. Please add a contact as a teammate first.</div>
              )}
              <input 
                type="number" 
                placeholder="Seconds" 
                value={node.duration || ''} 
                onChange={(e) => updateField('duration', parseInt(e.target.value))}
                className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm w-24"
              />
            </>
          )}
        </div>

        {node.action === 'sub_menu' && (
          <div className="pl-4 border-l-2 border-indigo-500/30 mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Sub-Menu Greeting message</label>
              <textarea 
                rows="2"
                value={node.greeting || ''} 
                onChange={(e) => updateField('greeting', e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm resize-none"
                placeholder="For billing, press 1. For support, press 2."
              />
            </div>
            
            <div className="space-y-3">
              {Object.keys(node.options || {}).sort().map((subKey) => (
                <IVRNode 
                  key={subKey} 
                  digit={subKey} 
                  node={node.options[subKey]} 
                  teammates={teammates}
                  onUpdate={(subNodeData) => {
                    const newOptions = { ...node.options };
                    if (subNodeData === null) delete newOptions[subKey];
                    else newOptions[subKey] = subNodeData;
                    updateField('options', newOptions);
                  }} 
                />
              ))}
              
              {Object.keys(node.options || {}).length < 9 && (
                <button 
                  type="button" 
                  onClick={() => {
                    const newOptions = { ...node.options };
                    for (let i = 1; i <= 9; i++) {
                      if (!newOptions[String(i)]) {
                        newOptions[String(i)] = { action: 'ring_team', teamRole: 'Sales', duration: 20 };
                        updateField('options', newOptions);
                        break;
                      }
                    }
                  }}
                  className="w-full border border-dashed border-white/20 hover:border-indigo-500/50 rounded-lg py-2 text-slate-400 hover:text-indigo-400 transition-colors text-xs font-medium"
                >
                  + Add Sub-Option
                </button>
              )}
            </div>
          </div>
        )}

        {(node.action === 'ring_team' || node.action === 'route_agent' || node.action === 'forward_call') && (
          <div className="pl-4 border-l-2 border-white/10 mt-4">
            {node.fallback ? (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">If no answer</span>
                  <div className="h-px bg-white/10 flex-1"></div>
                  <button type="button" onClick={removeFallback} className="text-xs text-slate-500 hover:text-red-400">Remove</button>
                </div>
                <IVRNode 
                  digit="Timeout" 
                  node={node.fallback} 
                  teammates={teammates}
                  onUpdate={(fallbackData) => {
                    if (fallbackData === null) removeFallback();
                    else updateField('fallback', fallbackData);
                  }} 
                />
              </div>
            ) : (
              <button 
                type="button" 
                onClick={addFallback}
                className="text-xs font-medium text-slate-400 hover:text-indigo-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
              >
                + Add Fallback Action (If no answer)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

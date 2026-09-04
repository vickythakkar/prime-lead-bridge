'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState('contacts'); // contacts, properties, leads, messages, agents
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
      }
    }
    init();
  }, []);

  const fetchTrashItems = async (tab) => {
    setLoading(true);
    let table = '';
    let select = '*';
    if (tab === 'contacts') table = 'contacts';
    else if (tab === 'properties') table = 'properties';
    else if (tab === 'leads') { table = 'leads'; select = '*, properties(address)'; }
    else if (tab === 'messages') { table = 'conversations'; select = '*, contacts(name)'; }
    else if (tab === 'agents') table = 'agents';
    else if (tab === 'tasks') table = 'tasks';

    let query = supabase
      .from(table)
      .select(select)
      .eq('organization_id', orgId)
      .eq('is_deleted', true)
      .order('created_at', { ascending: false });

    // Handle agents table which may not have organization_id
    if (table === 'agents') {
      query = supabase
        .from(table)
        .select(select)
        .eq('is_deleted', true)
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (!error && data) {
      setItems(data);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orgId) {
      fetchTrashItems(activeTab);
    }
  }, [activeTab, orgId]);

  const handleRestore = async (id) => {
    let table = activeTab === 'messages' ? 'conversations' : activeTab;
    const { error } = await supabase.from(table).update({ is_deleted: false }).eq('id', id);
    if (!error) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this? It cannot be undone.')) return;
    let table = activeTab === 'messages' ? 'conversations' : activeTab;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      setItems(items.filter(item => item.id !== id));
    } else {
      alert('Failed to delete. It might be referenced by other records.');
    }
  };

  const renderItemName = (item) => {
    let name = 'Unknown Item';
    if (activeTab === 'contacts' || activeTab === 'agents') name = item.name || item.phone || item.cell_phone;
    else if (activeTab === 'properties') name = item.address;
    else if (activeTab === 'leads') name = `Lead: ${item.caller_phone} (Property: ${item.properties?.address || 'Unknown'})`;
    else if (activeTab === 'messages') name = `Conversation: ${item.contacts?.name || item.contact_phone}`;
    else if (activeTab === 'tasks') name = `${item.title}${item.phone_number ? ' — ' + item.phone_number : ''}`;

    if (activeTab === 'tasks') {
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-slate-200">{name}</span>
          <div className="flex items-center gap-2">
            {item.disposition && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider shrink-0">
                {item.disposition}
              </span>
            )}
            {item.description && (
              <span className="text-xs text-slate-400 italic line-clamp-1">"{item.description}"</span>
            )}
            {!item.disposition && !item.description && (
              <span className="text-xs text-slate-600 italic">No notes</span>
            )}
          </div>
        </div>
      );
    }

    return name;
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Trash / Recycle Bin</h1>
        <p className="text-slate-400 mt-1">Restore or permanently delete soft-deleted items. Items are auto-purged after 30 days.</p>
      </header>

      <div className="mb-6 flex space-x-2 border-b border-white/10 overflow-x-auto pb-2">
        {['contacts', 'properties', 'leads', 'messages', 'tasks', 'agents'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-white/10 text-white border-b-2 border-indigo-500' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading trash...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🗑️</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Trash is empty</h3>
            <p className="text-slate-400 text-sm">No deleted {activeTab} found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/40 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Deleted Date</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-300">
                      {renderItemName(item)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      <div className="flex flex-col">
                        <span>{new Date(item.deleted_at || item.updated_at || item.created_at).toLocaleDateString()}</span>
                        {(() => {
                          const delDate = new Date(item.deleted_at || item.updated_at || item.created_at);
                          const purgeDate = new Date(delDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                          const daysRemaining = Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24));
                          return (
                            <span className={`text-xs ${daysRemaining <= 5 ? 'text-rose-400 font-medium' : 'text-slate-500'}`}>
                              {daysRemaining > 0 ? `${daysRemaining} days left` : 'Purging soon'}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        <button 
                          onClick={() => handleRestore(item.id)} 
                          className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Restore
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(item.id)} 
                          className="bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

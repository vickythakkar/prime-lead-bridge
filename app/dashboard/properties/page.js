'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PropertiesDirectory() {
  const [properties, setProperties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orgNumbers, setOrgNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [view, setView] = useState('active'); // 'active' or 'trash'

  const [newProp, setNewProp] = useState({
    address: '', street_number: '', zip_code: '', 
    agent_id: '', seller_name: '', seller_email: '', seller_phone: '', 
    route_to: 'seller', organization_number_id: ''
  });

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase.from('agents').select('organization_id').limit(1).single();
      if (agentData) {
        const oId = agentData.organization_id;
        setOrgId(oId);
        
        // Load properties
        const { data: propData } = await supabase.from('properties')
          .select('*, agents(name), organization_numbers(phone_number)')
          .eq('organization_id', oId).order('created_at', { ascending: false });
        if (propData) setProperties(propData);

        // Load agents for dropdown
        const { data: agData } = await supabase.from('agents').select('*').eq('organization_id', oId);
        if (agData) setAgents(agData);

        // Load numbers for dropdown
        const { data: numData } = await supabase.from('organization_numbers').select('*').eq('organization_id', oId);
        if (numData) setOrgNumbers(numData);

        if (agData?.length > 0 && numData?.length > 0) {
          setNewProp(p => ({...p, agent_id: agData[0].id, organization_number_id: numData[0].id}));
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  async function handleAddProperty(e) {
    e.preventDefault();
    if (!orgId) return;

    const { data, error } = await supabase
      .from('properties')
      .insert([{ 
        organization_id: orgId,
        ...newProp
      }])
      .select('*, agents(name), organization_numbers(phone_number)');

    if (!error && data) {
      setProperties([data[0], ...properties]);
      setShowModal(false);
      // Reset
      setNewProp({
        address: '', street_number: '', zip_code: '', 
        agent_id: agents.length > 0 ? agents[0].id : '', 
        seller_name: '', seller_email: '', seller_phone: '', 
        route_to: 'seller', 
        organization_number_id: orgNumbers.length > 0 ? orgNumbers[0].id : ''
      });
    } else {
      console.error(error);
      alert("Error adding property");
    }
  }

  async function handleToggleActive(id, currentStatus) {
    await supabase.from('properties').update({ is_active: !currentStatus }).eq('id', id);
    setProperties(properties.map(p => p.id === id ? {...p, is_active: !currentStatus} : p));
  }

  async function handleTrash(id) {
    await supabase.from('properties').update({ is_deleted: true, is_active: false }).eq('id', id);
    setProperties(properties.map(p => p.id === id ? {...p, is_deleted: true, is_active: false} : p));
  }

  async function handleRestore(id) {
    await supabase.from('properties').update({ is_deleted: false, is_active: true }).eq('id', id);
    setProperties(properties.map(p => p.id === id ? {...p, is_deleted: false, is_active: true} : p));
  }

  const displayedProperties = properties.filter(p => view === 'active' ? !p.is_deleted : p.is_deleted);

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Active Listings</h1>
          <p className="text-slate-400 mt-1">Manage properties and call routing preferences.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
        >
          + Add Property
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setView('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === 'active' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          Active Properties
        </button>
        <button 
          onClick={() => setView('trash')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${view === 'trash' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'}`}
        >
          🗑️ Trash
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading properties...</div>
        ) : displayedProperties.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">{view === 'active' ? '🏠' : '🗑️'}</div>
            <h3 className="text-lg font-medium text-white mb-2">{view === 'active' ? 'No properties yet' : 'Trash is empty'}</h3>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Address</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Assigned Number</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300">Routing To</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayedProperties.map((prop) => (
                <tr key={prop.id} className={`hover:bg-white/5 transition-colors ${!prop.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    {view === 'active' ? (
                      <button 
                        onClick={() => handleToggleActive(prop.id, prop.is_active)}
                        className={`px-3 py-1 text-xs font-bold rounded-full border ${prop.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-600'}`}
                      >
                        {prop.is_active ? 'Active' : 'Deactivated'}
                      </button>
                    ) : (
                      <span className="text-red-400 text-xs font-bold px-3 py-1 bg-red-500/10 rounded-full">Deleted</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{prop.address}</td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-sm">
                    {prop.organization_numbers?.phone_number || 'Unassigned'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/10 text-slate-300 border border-white/5">
                      {prop.route_to === 'seller' ? '👤 Seller' : '👥 Listing Agent'}
                    </span>
                    <div className="text-xs text-slate-500 mt-1">
                      {prop.route_to === 'seller' ? `${prop.seller_name || ''} ${prop.seller_phone}` : prop.agents?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {view === 'active' ? (
                      <button 
                        onClick={() => handleTrash(prop.id)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        Trash
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRestore(prop.id)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Property Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card w-full max-w-2xl rounded-2xl p-6 border border-white/10 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add New Property</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddProperty} className="space-y-4">
              
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                <label className="block text-sm font-bold text-indigo-300 mb-2">Assign to Twilio Number</label>
                <select 
                  required
                  className="w-full bg-slate-900/50 border border-indigo-500/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newProp.organization_number_id} onChange={(e) => setNewProp({...newProp, organization_number_id: e.target.value})}
                >
                  <option value="">Select a number...</option>
                  {orgNumbers.map(n => <option key={n.id} value={n.id}>{n.phone_number}</option>)}
                </select>
                {orgNumbers.length === 0 && <p className="text-red-400 text-xs mt-2">You don't have any numbers. Go to "My Numbers" to buy one.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Address (Spoken by IVR)</label>
                <input 
                  type="text" required placeholder="123 Oak St, Springfield"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newProp.address} onChange={(e) => setNewProp({...newProp, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Street Number (For Lookup)</label>
                  <input 
                    type="text" required placeholder="123"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={newProp.street_number} onChange={(e) => setNewProp({...newProp, street_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Zip Code (For Lookup)</label>
                  <input 
                    type="text" required placeholder="90210"
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={newProp.zip_code} onChange={(e) => setNewProp({...newProp, zip_code: e.target.value})}
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 mt-2">
                <h3 className="text-sm font-bold text-white mb-3">Call Routing Setup</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Listing Agent</label>
                    <select 
                      required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={newProp.agent_id} onChange={(e) => setNewProp({...newProp, agent_id: e.target.value})}
                    >
                      <option value="">Select Agent...</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Seller Name</label>
                    <input 
                      type="text" required
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={newProp.seller_name} onChange={(e) => setNewProp({...newProp, seller_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Seller Email</label>
                    <input 
                      type="email"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={newProp.seller_email} onChange={(e) => setNewProp({...newProp, seller_email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Seller's Phone</label>
                    <input 
                      type="tel" required placeholder="+1234567890"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                      value={newProp.seller_phone} onChange={(e) => setNewProp({...newProp, seller_phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                  <label className="block text-sm font-medium text-slate-300 mb-2">When a buyer confirms this property, route the call to:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" name="route_to" value="seller"
                        checked={newProp.route_to === 'seller'}
                        onChange={(e) => setNewProp({...newProp, route_to: e.target.value})}
                        className="text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-white">Seller</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" name="route_to" value="agent"
                        checked={newProp.route_to === 'agent'}
                        onChange={(e) => setNewProp({...newProp, route_to: e.target.value})}
                        className="text-indigo-500 focus:ring-indigo-500"
                      />
                      <span className="text-white">Listing Agent</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={orgNumbers.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

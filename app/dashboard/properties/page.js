'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [orgNumbers, setOrgNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const initialForm = {
    address: '',
    street_number: '',
    zip_code: '',
    seller_name: '',
    seller_email: '',
    seller_phone: '',
    route_to: 'seller',
    agent_id: '',
    organization_number_id: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data: agentData } = await supabase
        .from('agents')
        .select('organization_id')
        .eq('id', session.user.id)
        .single();
        
      if (agentData) {
        setOrgId(agentData.organization_id);
        
        // Load properties
        const { data: propsData } = await supabase
          .from('properties')
          .select('*, agents(name, cell_phone), organization_numbers(phone_number)')
          .eq('organization_id', agentData.organization_id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
          
        if (propsData) setProperties(propsData);

        // Load agents for dropdown
        const { data: agentsData } = await supabase
          .from('agents')
          .select('id, name, cell_phone')
          .eq('organization_id', agentData.organization_id);
        if (agentsData) setAgents(agentsData);

        // Load numbers for dropdown
        const { data: numbersData } = await supabase
          .from('organization_numbers')
          .select('id, phone_number')
          .eq('organization_id', agentData.organization_id);
        if (numbersData) setOrgNumbers(numbersData);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const startEditing = (prop) => {
    setEditingId(prop.id);
    setFormData({
      address: prop.address || '',
      street_number: prop.street_number || '',
      zip_code: prop.zip_code || '',
      seller_name: prop.seller_name || '',
      seller_email: prop.seller_email || '',
      seller_phone: prop.seller_phone || '',
      route_to: prop.route_to || 'seller',
      agent_id: prop.agent_id || '',
      organization_number_id: prop.organization_number_id || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        organization_id: orgId,
        ...formData,
        agent_id: formData.agent_id || null,
        organization_number_id: formData.organization_number_id || null
      };

      let savedProp = null;

      if (editingId) {
        const { data, error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', editingId)
          .select('*, agents(name, cell_phone), organization_numbers(phone_number)')
          .single();
        if (error) throw error;
        savedProp = data;
        setProperties(properties.map(p => p.id === editingId ? data : p));
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert(payload)
          .select('*, agents(name, cell_phone), organization_numbers(phone_number)')
          .single();
        if (error) throw error;
        savedProp = data;
        setProperties([data, ...properties]);
      }

      // Auto-save Seller to Contacts
      if (formData.seller_phone) {
        try {
          const { data: existingSeller } = await supabase.from('contacts').select('id').eq('organization_id', orgId).eq('phone', formData.seller_phone).maybeSingle();
          if (existingSeller) {
            await supabase.from('contacts').update({ name: formData.seller_name, updated_at: new Date().toISOString(), custom_fields: { role: 'Seller' } }).eq('id', existingSeller.id);
          } else {
            await supabase.from('contacts').insert({ organization_id: orgId, phone: formData.seller_phone, name: formData.seller_name, custom_fields: { role: 'Seller' } });
          }
        } catch(e) { console.error('Seller sync error', e); }
      }

      // Auto-save Agent to Contacts
      if (formData.agent_id) {
        const agent = agents.find(a => a.id === formData.agent_id);
        if (agent && agent.cell_phone) {
          try {
            const { data: existingAgent } = await supabase.from('contacts').select('id').eq('organization_id', orgId).eq('phone', agent.cell_phone).maybeSingle();
            if (existingAgent) {
              await supabase.from('contacts').update({ name: agent.name, updated_at: new Date().toISOString(), custom_fields: { role: 'Agent' } }).eq('id', existingAgent.id);
            } else {
              await supabase.from('contacts').insert({ organization_id: orgId, phone: agent.cell_phone, name: agent.name, custom_fields: { role: 'Agent' } });
            }
          } catch(e) { console.error('Agent sync error', e); }
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      console.error(err);
      alert('Failed to save property');
    } finally {
      setSaving(false);
    }
  };

  const deleteProperty = async (id) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    const { error } = await supabase.from('properties').update({ is_deleted: true }).eq('id', id);
    if (!error) {
      setProperties(properties.filter(p => p.id !== id));
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const { error } = await supabase.from('properties').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setProperties(properties.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
    }
  };

  const fileInputRef = useRef(null);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  
  const downloadTemplate = () => {
    const csvContent = "address,street_number,zip_code,seller_name,seller_phone,route_to\n123 Main St,123,62701,John Doe,+1234567890,seller\n456 Oak Ave,456,62702,Jane Smith,+1987654321,seller";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'properties_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCSV(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        let addedCount = 0;
        
        for (const row of rows) {
          if (!row.address || !row.street_number) continue;
          
          try {
            const payload = {
              organization_id: orgId,
              address: row.address,
              street_number: row.street_number,
              zip_code: row.zip_code || '',
              seller_name: row.seller_name || '',
              seller_phone: row.seller_phone || '',
              route_to: row.route_to === 'agent' ? 'agent' : 'seller',
              agent_id: null,
              organization_number_id: null
            };
            
            const { data, error } = await supabase
              .from('properties')
              .insert(payload)
              .select('*, agents(name, cell_phone), organization_numbers(phone_number)')
              .single();
              
            if (!error && data) {
              addedCount++;
              setProperties(prev => [data, ...prev]);

              // Auto-save Seller to Contacts
              if (row.seller_phone) {
                try {
                  const { data: existingSeller } = await supabase.from('contacts').select('id').eq('organization_id', orgId).eq('phone', row.seller_phone).maybeSingle();
                  if (existingSeller) {
                    await supabase.from('contacts').update({ name: row.seller_name, updated_at: new Date().toISOString(), custom_fields: { role: 'Seller' } }).eq('id', existingSeller.id);
                  } else {
                    await supabase.from('contacts').insert({ organization_id: orgId, phone: row.seller_phone, name: row.seller_name, custom_fields: { role: 'Seller' } });
                  }
                } catch(e) { console.error('Seller sync error', e); }
              }
            }
          } catch(err) {
            console.error('Error adding row:', row, err);
          }
        }
        
        setUploadingCSV(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert(`Successfully imported ${addedCount} properties!`);
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        setUploadingCSV(false);
        alert('Failed to parse CSV file.');
      }
    });
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Active Listings</h1>
          <p className="text-slate-400 mt-1">Manage your properties and call routing.</p>
        </div>
        <div className="flex gap-3 items-center">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={downloadTemplate}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium mr-2"
          >
            Download CSV Template
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCSV}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors border border-white/10 disabled:opacity-50"
          >
            {uploadingCSV ? 'Uploading...' : 'Bulk Upload CSV'}
          </button>
          <button 
            onClick={() => { setEditingId(null); setFormData(initialForm); setShowModal(true); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg"
          >
            + Add Property
          </button>
        </div>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading properties...</div>
        ) : properties.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">🏠</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Properties Yet</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-6">Add your active listings here to set up routing rules.</p>
            <button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
              Add Your First Property
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/40 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Number</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Routing To</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {properties.map((prop) => (
                  <tr key={prop.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(prop.id, prop.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${prop.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                      >
                        {prop.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{prop.address}</div>
                      <div className="text-xs text-slate-500 mt-1">Match: {prop.street_number} / {prop.zip_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-indigo-300">
                        {prop.organization_numbers?.phone_number || 'None'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {prop.route_to === 'seller' ? (
                        <div>
                          <div className="text-emerald-400 text-sm font-medium">Seller: {prop.seller_name}</div>
                          <div className="text-xs text-slate-500">{prop.seller_phone}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-indigo-400 text-sm font-medium">Agent: {prop.agents?.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{prop.agents?.cell_phone || 'No phone'}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => startEditing(prop)}
                          className="text-slate-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                        </button>
                        <button 
                          onClick={() => deleteProperty(prop.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Edit Property' : 'Add New Property'}</h2>
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4">
                  <label className="block text-sm font-bold text-indigo-300 mb-2">Assign to Twilio Number</label>
                  <select 
                    className="w-full bg-slate-900/50 border border-indigo-500/50 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={formData.organization_number_id} onChange={(e) => setFormData({...formData, organization_number_id: e.target.value})}
                  >
                    <option value="">Select a number...</option>
                    {orgNumbers.map(n => <option key={n.id} value={n.id}>{n.phone_number}</option>)}
                  </select>
                </div>

                <h3 className="text-lg font-semibold text-indigo-400 border-b border-white/10 pb-2">Property Details</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Address</label>
                  <input type="text" required placeholder="123 Main St, Springfield, IL 62701" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                    value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Street Number</label>
                    <input type="text" required placeholder="123" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                      value={formData.street_number} onChange={(e) => setFormData({...formData, street_number: e.target.value})} />
                    <p className="text-xs text-slate-500 mt-1">Callers press this number to search.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">ZIP Code</label>
                    <input type="text" required placeholder="62701" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                      value={formData.zip_code} onChange={(e) => setFormData({...formData, zip_code: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold text-indigo-400 border-b border-white/10 pb-2">Seller Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Seller Name</label>
                    <input type="text" required className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                      value={formData.seller_name} onChange={(e) => setFormData({...formData, seller_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Seller Phone</label>
                    <input type="tel" required placeholder="+1234567890" className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                      value={formData.seller_phone} onChange={(e) => setFormData({...formData, seller_phone: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-semibold text-indigo-400 border-b border-white/10 pb-2">Routing Configuration</h3>
                <p className="text-sm text-slate-400">When a buyer looks up this property via the IVR, where should the call be routed?</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer border p-4 rounded-xl flex items-center gap-3 transition-colors ${formData.route_to === 'seller' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                    <input type="radio" name="route_to" value="seller" checked={formData.route_to === 'seller'} onChange={() => setFormData({...formData, route_to: 'seller'})} className="text-indigo-500" />
                    <div>
                      <div className="font-bold text-white">Route to Seller</div>
                      <div className="text-xs text-slate-400">Call rings the seller directly</div>
                    </div>
                  </label>
                  <label className={`cursor-pointer border p-4 rounded-xl flex items-center gap-3 transition-colors ${formData.route_to === 'agent' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                    <input type="radio" name="route_to" value="agent" checked={formData.route_to === 'agent'} onChange={() => setFormData({...formData, route_to: 'agent'})} className="text-indigo-500" />
                    <div>
                      <div className="font-bold text-white">Route to Agent</div>
                      <div className="text-xs text-slate-400">Call rings an assigned agent</div>
                    </div>
                  </label>
                </div>
                
                {formData.route_to === 'agent' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Select Agent</label>
                    <select required className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" 
                      value={formData.agent_id} onChange={(e) => setFormData({...formData, agent_id: e.target.value})}>
                      <option value="">Select an agent...</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-lg font-medium text-slate-400 hover:text-white hover:bg-white/5">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Property'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', company: '' });

  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await fetch('/api/contacts');
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        } else {
          // Mock data
          setContacts([
            { id: 1, name: 'John Seller', phone: '+15550102030', email: 'john@example.com', company: 'Acme Corp', avatar: 'JS' },
            { id: 2, name: 'Alice Buyer', phone: '+15559908877', email: 'alice@investments.co', company: 'Investments Co', avatar: 'AB' }
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchContacts();
  }, []);

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      
      if (res.ok) {
        const added = await res.json();
        setContacts([added, ...contacts]);
      } else {
        // Mock add
        const added = { ...newContact, id: Date.now(), avatar: newContact.name.substring(0, 2).toUpperCase() };
        setContacts([added, ...contacts]);
      }
      setShowModal(false);
      setNewContact({ name: '', phone: '', email: '', company: '' });
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search) || 
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-slate-400 mt-1">Manage your leads, sellers, and buyers in one place.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2"
        >
          <span>+ Add Contact</span>
        </button>
      </header>

      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input 
            type="text" 
            placeholder="Search contacts by name, phone, or email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-white mb-2">No contacts found</h3>
            <p className="text-slate-400">Try adjusting your search or add a new contact.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Contact Info</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300">Company</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold">
                          {contact.avatar || contact.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{contact.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 text-sm mb-0.5">{contact.phone}</div>
                      <div className="text-slate-500 text-xs">{contact.email || 'No email provided'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {contact.company || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors" title="Send Message">
                          💬
                        </button>
                        <button className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors" title="Call Contact">
                          📞
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

      {/* Add Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add New Contact</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input 
                  type="text" required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newContact.name} onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                <input 
                  type="tel" required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newContact.phone} onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email Address (Optional)</label>
                <input 
                  type="email"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newContact.email} onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Company (Optional)</label>
                <input 
                  type="text"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                  value={newContact.company} onChange={(e) => setNewContact({...newContact, company: e.target.value})}
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3 border-t border-white/5 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

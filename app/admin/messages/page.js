'use client';
import { useState, useEffect } from 'react';

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          window.location.href = '/admin';
          return;
        }

        const res = await fetch('/api/sms/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        } else {
          setConversations([]);
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      // Load messages from the active conversation
      const sortedMessages = (activeConversation.messages || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const formatted = sortedMessages.map(msg => ({
        id: msg.id,
        text: msg.body,
        sender: msg.direction === 'outbound' ? 'me' : 'them',
        timestamp: msg.created_at
      }));
      
      setMessages(formatted);
    }
  }, [activeConversation]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    setSending(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ to: activeConversation.contact_number, body: newMessage })
      });
      
      if (res.ok) {
        setMessages([...messages, { id: Date.now(), text: newMessage, sender: 'me', timestamp: new Date().toISOString() }]);
        setNewMessage('');
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Admin Global Messages</h1>
        <p className="text-slate-400 mt-1">View and manage SMS conversations globally.</p>
      </header>

      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex border border-white/10">
        <div className="w-1/3 border-r border-white/5 flex flex-col bg-[#0a0a0e]/50">
          <div className="p-4 border-b border-white/5">
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500 text-sm">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No conversations yet</div>
            ) : (
              conversations.map(conv => (
                <div 
                  key={conv.contact_number} 
                  onClick={() => setActiveConversation(conv)}
                  className={`p-4 cursor-pointer transition-colors border-l-2 ${activeConversation?.contact_number === conv.contact_number ? 'bg-indigo-500/10 border-indigo-500' : 'border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-white truncate">{conv.contact?.name || conv.contact_number}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                      {new Date(conv.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 truncate">{conv.last_message_body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-2/3 flex flex-col bg-[#0a0a0e]/30">
          {activeConversation ? (
            <>
              <div className="p-4 border-b border-white/5 bg-[#0a0a0e]/80 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{activeConversation.contact?.name || activeConversation.contact_number}</h3>
                  <p className="text-xs text-slate-400">{activeConversation.contact_number}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
                      <p className="text-sm">{msg.text}</p>
                      <p className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-white/5 bg-[#0a0a0e]/80">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type an SMS message..." 
                    className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px]"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <span className="text-5xl mb-4">💬</span>
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

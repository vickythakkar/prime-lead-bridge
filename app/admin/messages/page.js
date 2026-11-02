'use client';
import { useState, useEffect, useRef } from 'react';

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
          const list = data.conversations || [];
          setConversations(list);
          if (list.length > 0 && !activeConversation) {
            setActiveConversation(list[0]);
          }
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
      const sorted = (activeConversation.messages || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const formatted = sorted.map(msg => ({
        id: msg.id,
        text: msg.body,
        sender: msg.direction === 'outbound' ? 'me' : 'them',
        timestamp: msg.created_at
      }));
      
      setMessages(formatted);

      // If there are unread messages, mark them as read on the server
      if (activeConversation.unread_count > 0) {
        markConversationRead(activeConversation.id);
      }
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const markConversationRead = async (conversationId) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/sms/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ conversationId })
      });

      // Update local state unread count
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin-notifications-updated'));
      }
    } catch (e) {
      console.warn('Could not mark conversation as read:', e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const textToSend = newMessage.trim();
    setSending(true);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          to: activeConversation.contact_phone, 
          text: textToSend,
          orgId: activeConversation.organization_id,
          conversationId: activeConversation.id
        })
      });
      
      if (res.ok) {
        const newMsgObj = { 
          id: Date.now(), 
          text: textToSend, 
          sender: 'me', 
          timestamp: new Date().toISOString() 
        };

        setMessages(prev => [...prev, newMsgObj]);
        setNewMessage('');

        // Update conversation list item to show latest message and move to top
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === activeConversation.id) {
              return {
                ...c,
                last_message_body: textToSend,
                last_message_at: newMsgObj.timestamp,
                messages: [...(c.messages || []), {
                  id: newMsgObj.id,
                  body: textToSend,
                  direction: 'outbound',
                  created_at: newMsgObj.timestamp
                }]
              };
            }
            return c;
          });
          return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to send message: ${err.error || 'Server error'}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message due to network error');
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (conv.contact_name && conv.contact_name.toLowerCase().includes(q)) ||
      (conv.contact_phone && conv.contact_phone.includes(q)) ||
      (conv.organization_name && conv.organization_name.toLowerCase().includes(q)) ||
      (conv.last_message_body && conv.last_message_body.toLowerCase().includes(q))
    );
  });

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Global Messages</h1>
          <p className="text-slate-400 mt-1">View and manage SMS conversations globally across all organizations.</p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-lg">
          {conversations.length} total conversation{conversations.length === 1 ? '' : 's'}
        </div>
      </header>

      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex border border-white/10">
        {/* Left Panel: Conversation List */}
        <div className="w-1/3 border-r border-white/5 flex flex-col bg-[#0a0a0e]/50">
          <div className="p-4 border-b border-white/5">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or org..." 
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isSelected = activeConversation?.id === conv.id;
                return (
                  <div 
                    key={conv.id} 
                    onClick={() => setActiveConversation(conv)}
                    className={`p-4 cursor-pointer transition-colors border-l-2 ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500' 
                        : 'border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {conv.unread_count > 0 && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                        )}
                        <span className="font-medium text-white truncate text-sm">
                          {conv.contact_name || conv.contact_phone}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">
                        {conv.last_message_at 
                          ? new Date(conv.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-slate-400 truncate font-mono">
                        {conv.contact_phone}
                      </span>
                      {conv.organization_name && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-indigo-500/20 truncate max-w-[130px]">
                          {conv.organization_name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 truncate">
                      {conv.last_message_body || 'No messages'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Conversation Thread */}
        <div className="w-2/3 flex flex-col bg-[#0a0a0e]/30">
          {activeConversation ? (
            <>
              <div className="p-4 border-b border-white/5 bg-[#0a0a0e]/80 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">
                    {activeConversation.contact_name || activeConversation.contact_phone}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-400 font-mono">{activeConversation.contact_phone}</p>
                    {activeConversation.organization_name && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {activeConversation.organization_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.sender === 'me' 
                          ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-600/10' 
                          : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-white/5 bg-[#0a0a0e]/80">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type an SMS reply..." 
                    className="flex-1 bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[100px] text-sm"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <span className="text-5xl mb-4">💬</span>
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

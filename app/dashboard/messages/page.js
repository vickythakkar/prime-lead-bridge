'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [orgId, setOrgId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        fetchConversations(agentData.organization_id);
      }
    }
    init();
  }, []);

  async function fetchConversations(organizationId) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contact_phone,
          last_message_at,
          last_message_body,
          is_deleted,
          contacts ( name )
        `)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .order('last_message_at', { ascending: false });

      if (data) {
        setConversations(data.map(d => ({
          id: d.id,
          phone: d.contact_phone,
          name: d.contacts?.name || d.contact_phone,
          lastMessage: d.last_message_body,
          timestamp: d.last_message_at
        })));
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(id) {
    if (!confirm('Send this conversation to the trash?')) return;
    const { error } = await supabase.from('conversations').update({ is_deleted: true }).eq('id', id);
    if (!error) {
      setConversations(conversations.filter(c => c.id !== id));
      if (activeConversation?.id === id) setActiveConversation(null);
    }
  }

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      
      // Subscribe to real-time new messages
      const channel = supabase
        .channel(`messages_${activeConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversation.id}`
          },
          (payload) => {
            setMessages(prev => [...prev, {
              id: payload.new.id,
              text: payload.new.body,
              sender: payload.new.direction === 'outbound' ? 'me' : 'them',
              timestamp: payload.new.created_at
            }]);
            fetchConversations(orgId); // refresh sidebar
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchMessages(conversationId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        text: m.body,
        sender: m.direction === 'outbound' ? 'me' : 'them',
        timestamp: m.created_at
      })));

      // Mark unread messages as read
      const unreadIds = data.filter(m => !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      }
    }
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !orgId) return;

    setSending(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeConversation.phone, text: newMessage, orgId })
      });
      
      if (res.ok) {
        setNewMessage('');
        // We rely on real-time sub to add the message to the UI
      } else {
        const err = await res.json();
        alert('Error sending SMS: ' + (err.error || 'Unknown'));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-80px)] flex flex-col">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-slate-400 mt-1">Manage SMS conversations with your leads and contacts.</p>
      </header>

      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex border border-white/10">
        {/* Left Panel: Conversation List */}
        <div className="w-1/3 border-r border-white/5 flex flex-col bg-slate-900/50">
          <div className="p-4 border-b border-white/5">
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
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
                  key={conv.id} 
                  onClick={() => setActiveConversation(conv)}
                  className={`p-4 cursor-pointer transition-colors border-l-2 ${activeConversation?.id === conv.id ? 'bg-indigo-500/10 border-indigo-500' : 'border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-white truncate">{conv.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(conv.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                        className="text-slate-600 hover:text-rose-400"
                        title="Trash Conversation"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 truncate">{conv.lastMessage}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Active Conversation */}
        <div className="w-2/3 flex flex-col bg-slate-950/30">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/5 bg-slate-900/40 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{activeConversation.name}</h3>
                  <p className="text-xs text-slate-400">{activeConversation.phone}</p>
                </div>
                <a href={`/dashboard/dialer?phone=${encodeURIComponent(activeConversation.phone)}`} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-emerald-500/20 hover:text-emerald-400">
                  <span className="text-xl">📞</span>
                </a>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-slate-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-white/5 bg-slate-900/40">
                <form onSubmit={handleSend} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type an SMS message..." 
                    className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
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

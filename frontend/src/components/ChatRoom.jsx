import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Search, Hash, User, MessageSquare, Shield, Activity, Users, Loader2 } from 'lucide-react';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function ChatRoom({ user, socket }) {
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [activeChat, setActiveChat] = useState({ type: 'channel', id: 'all_staff' }); // default
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});

  const messagesEndRef = useRef(null);

  // Available channels based on role
  const getVisibleChannels = () => {
    const role = user.role;
    const staffRole = user.staff_role ? user.staff_role.toLowerCase() : '';

    if (role === 'admin') {
      return [
        { id: 'all_staff', name: 'all-staff', desc: 'All Staff & CHWs' },
        { id: 'social_worker', name: 'social-workers', desc: 'Social Workers Channel' },
        { id: 'therapist', name: 'therapists', desc: 'Therapists Channel' },
        { id: 'chw', name: 'chws', desc: 'CHW Channel' },
        { id: 'patient', name: 'patients', desc: 'All Patients' },
        { id: 'doctor_nurse', name: 'doctors-nurses', desc: 'Doctors & Nurses' }
      ];
    }

    if (role === 'patient') {
      return [
        { id: 'patient', name: 'patients', desc: 'Patient Support Channel' }
      ];
    }

    const channels = [];
    if (role === 'staff' || role === 'chw') {
      channels.push({ id: 'all_staff', name: 'all-staff', desc: 'All Staff & CHWs' });
    }

    if (role === 'chw') {
      channels.push({ id: 'chw', name: 'chws', desc: 'CHWs Channel' });
    }

    if (role === 'staff') {
      if (staffRole.includes('social worker')) {
        channels.push({ id: 'social_worker', name: 'social-workers', desc: 'Social Workers Channel' });
      } else if (staffRole.includes('therapist')) {
        channels.push({ id: 'therapist', name: 'therapists', desc: 'Therapists Channel' });
      } else if (staffRole.includes('doctor') || staffRole.includes('nurse')) {
        channels.push({ id: 'doctor_nurse', name: 'doctors-nurses', desc: 'Doctors & Nurses' });
      }
    }

    return channels;
  };

  const visibleChannels = getVisibleChannels();

  const getLastChannelMessage = (chId) => {
    const chMsgs = messages.filter(m => m.recipient_type === chId);
    if (chMsgs.length === 0) return null;
    return chMsgs[chMsgs.length - 1];
  };

  const getLastDM = (uId, uRole) => {
    const dmMsgs = messages.filter(m => {
      const targetId = uId.toString();
      const targetRole = uRole;
      const currentUserId = user.id.toString();
      const currentUserRole = user.role;

      return m.recipient_type === 'individual' && (
        (m.recipient_id?.toString() === currentUserId && m.recipient_role === currentUserRole && m.sender_id?.toString() === targetId && m.sender_role === targetRole) ||
        (m.sender_id?.toString() === currentUserId && m.sender_role === currentUserRole && m.recipient_id?.toString() === targetId && m.recipient_role === targetRole)
      );
    });
    if (dmMsgs.length === 0) return null;
    return dmMsgs[dmMsgs.length - 1];
  };

  // Set initial active chat if the default channel is not visible to the user
  useEffect(() => {
    if (visibleChannels.length > 0 && !visibleChannels.some(c => c.id === activeChat.id)) {
      setActiveChat({ type: 'channel', id: visibleChannels[0].id });
    }
  }, [user]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeChat]);

  // Fetch users and messages on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingUsers(true);
      try {
        const uRes = await api.get('/auth/chat/users');
        setUsersList(uRes.data.users || []);
      } catch (err) {
        console.error('Error fetching chat users:', err);
      } finally {
        setLoadingUsers(false);
      }

      setLoadingMessages(true);
      try {
        const mRes = await api.get('/auth/chat/messages');
        setMessages(mRes.data.messages || []);
      } catch (err) {
        console.error('Error fetching chat messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchData();
  }, [user]);

  // Set up socket listener for real-time messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // Append new message
      setMessages(prev => {
        // Prevent duplicate appending
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Handle unread badges
      const isFromSelf = msg.sender_id.toString() === user.id.toString() && msg.sender_role === user.role;
      if (!isFromSelf) {
        let chatKey = '';
        if (msg.recipient_type === 'individual') {
          chatKey = `dm_${msg.sender_role}_${msg.sender_id}`;
        } else {
          chatKey = `channel_${msg.recipient_type}`;
        }

        const activeChatKey = activeChat.type === 'channel' 
          ? `channel_${activeChat.id}` 
          : `dm_${activeChat.role}_${activeChat.id}`;

        if (chatKey !== activeChatKey) {
          setUnreadCounts(prev => ({
            ...prev,
            [chatKey]: (prev[chatKey] || 0) + 1
          }));
        }
      }
    };

    socket.on('new-message', handleNewMessage);

    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, activeChat, user]);

  // Clear unread counts for the active chat
  useEffect(() => {
    const activeChatKey = activeChat.type === 'channel' 
      ? `channel_${activeChat.id}` 
      : `dm_${activeChat.role}_${activeChat.id}`;

    if (unreadCounts[activeChatKey]) {
      setUnreadCounts(prev => ({
        ...prev,
        [activeChatKey]: 0
      }));
    }
  }, [activeChat]);

  // Filter messages for the current active chat
  const getFilteredMessages = () => {
    return messages.filter(msg => {
      if (activeChat.type === 'channel') {
        return msg.recipient_type === activeChat.id;
      } else {
        // DM
        const targetId = activeChat.id.toString();
        const targetRole = activeChat.role;
        const currentUserId = user.id.toString();
        const currentUserRole = user.role;

        return msg.recipient_type === 'individual' && (
          (msg.recipient_id?.toString() === currentUserId && msg.recipient_role === currentUserRole && msg.sender_id?.toString() === targetId && msg.sender_role === targetRole) ||
          (msg.sender_id?.toString() === currentUserId && msg.sender_role === currentUserRole && msg.recipient_id?.toString() === targetId && msg.recipient_role === targetRole)
        );
      }
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const payload = {
      message_text: newMessage,
      recipient_type: activeChat.type === 'channel' ? activeChat.id : 'individual',
      recipient_id: activeChat.type === 'dm' ? activeChat.id : null,
      recipient_role: activeChat.type === 'dm' ? activeChat.role : null
    };

    try {
      setNewMessage('');
      const res = await api.post('/auth/chat/messages', payload);
      // The socket broadcast will handle appending it, but let's append it manually if socket is slow/missing
      const savedMsg = res.data.chatMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === savedMsg.id)) return prev;
        return [...prev, savedMsg];
      });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Filter users by search query
  const filteredUsers = usersList.filter(u => 
    u.fullname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const getChatTitle = () => {
    if (activeChat.type === 'channel') {
      const ch = visibleChannels.find(c => c.id === activeChat.id);
      return ch ? `#${ch.name}` : `#${activeChat.id}`;
    } else {
      const usr = usersList.find(u => u.id === activeChat.id && u.role === activeChat.role);
      return usr ? usr.fullname : 'Direct Message';
    }
  };

  const getChatSubtitle = () => {
    if (activeChat.type === 'channel') {
      const ch = visibleChannels.find(c => c.id === activeChat.id);
      return ch ? ch.desc : 'Group discussion channel';
    } else {
      const usr = usersList.find(u => u.id === activeChat.id && u.role === activeChat.role);
      if (!usr) return 'Private Conversation';
      const roleText = usr.role === 'staff' 
        ? `${usr.staff_role || 'Clinician'}` 
        : usr.role.toUpperCase();
      return `${roleText} • Direct Message`;
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl h-[calc(100vh-14rem)] flex overflow-hidden backdrop-blur-md shadow-2xl">
      
      {/* Sidebar - Channels and Users */}
      <div className="w-80 border-r border-slate-800/80 flex flex-col bg-slate-950/40 shrink-0">
        
        {/* Search users */}
        <div className="p-4 border-b border-slate-800/80">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        {/* List Areas */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Channels Section */}
          {visibleChannels.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Channels</h4>
              <div className="space-y-1">
                {visibleChannels.map(ch => {
                  const isActive = activeChat.type === 'channel' && activeChat.id === ch.id;
                  const count = unreadCounts[`channel_${ch.id}`] || 0;
                  const lastMsg = getLastChannelMessage(ch.id);
                  const lastMsgText = lastMsg 
                    ? (lastMsg.sender_id.toString() === user.id.toString() && lastMsg.sender_role === user.role
                        ? `You: ${lastMsg.message_text}`
                        : `${lastMsg.sender_name.split(' ')[0]}: ${lastMsg.message_text}`)
                    : ch.desc;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChat({ type: 'channel', id: ch.id })}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-emerald-400 border border-emerald-500/20 shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                      }`}
                    >
                      <Hash className={`h-4 w-4 shrink-0 mt-0.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <div className="overflow-hidden flex-1 text-left">
                        <span className={`block truncate ${isActive ? 'text-emerald-400' : 'text-slate-200'}`}>{ch.name}</span>
                        <span className="text-[10px] text-slate-500 block truncate font-normal mt-0.5">{lastMsgText}</span>
                      </div>
                      {count > 0 && (
                        <span className="ml-auto bg-emerald-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full animate-pulse mt-0.5">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DMs Section */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Direct Messages</h4>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-[11px] text-slate-600 px-3 italic">No matching members found</p>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map(u => {
                  const isActive = activeChat.type === 'dm' && activeChat.id === u.id && activeChat.role === u.role;
                  const count = unreadCounts[`dm_${u.role}_${u.id}`] || 0;
                  const lastMsg = getLastDM(u.id, u.role);
                  const lastMsgText = lastMsg 
                    ? (lastMsg.sender_id.toString() === user.id.toString() && lastMsg.sender_role === user.role
                        ? `You: ${lastMsg.message_text}`
                        : lastMsg.message_text)
                    : (u.role === 'staff' ? (u.staff_role || 'Clinical Staff') : u.role.toUpperCase());

                  return (
                    <button
                      key={`${u.role}_${u.id}`}
                      onClick={() => setActiveChat({ type: 'dm', id: u.id, role: u.role })}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide text-left transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-emerald-400 border border-emerald-500/20 shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-300">
                          {u.fullname.split(' ').map(n=>n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                      </div>
                      <div className="overflow-hidden flex-1 text-left">
                        <span className="font-bold text-slate-200 truncate block">{u.fullname}</span>
                        <span className="text-[10px] text-slate-505 block truncate font-normal mt-0.5">{lastMsgText}</span>
                      </div>
                      {count > 0 && (
                        <span className="bg-emerald-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full animate-pulse shrink-0 mt-0.5">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Main Chat Screen */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-900/40">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              {activeChat.type === 'channel' ? <Hash className="h-4 w-4 text-emerald-400" /> : <User className="h-4 w-4 text-emerald-400" />}
              {getChatTitle()}
            </h3>
            <p className="text-[10px] text-slate-500">{getChatSubtitle()}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-slate-500 font-mono">UbuntuHealth Secure Chat</span>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-950/10">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
              <p className="text-slate-500 text-xs font-medium">Decrypting secure channel...</p>
            </div>
          ) : getFilteredMessages().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <MessageSquare className="h-10 w-10 text-slate-700 stroke-[1.5] mb-2" />
              <p className="text-xs">No messages in this chat yet</p>
              <p className="text-[10px] text-slate-500/70 mt-1 max-w-xs text-center">Messages are encrypted in transit and stored securely in accordance with health protocols.</p>
            </div>
          ) : (
            getFilteredMessages().map((msg) => {
              const isSelf = msg.sender_id.toString() === user.id.toString() && msg.sender_role === user.role;
              
              // Role/Specialty styling for other senders
              let senderTag = msg.sender_role.toUpperCase();
              if (msg.sender_role === 'staff') senderTag = 'CLINICIAN';

              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[75%] space-y-1 ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-slate-300">{isSelf ? 'You' : msg.sender_name}</span>
                    <span className="text-[9px] text-slate-500 font-semibold px-1 rounded bg-slate-800/60 uppercase">{senderTag}</span>
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    isSelf 
                      ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-none' 
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.message_text}
                  </div>
                  <span className="text-[9px] text-slate-600 font-mono">{formatTime(msg.created_at)}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/60 flex gap-3">
          <input
            type="text"
            placeholder="Type a clinical update or query..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
          />
          <button
            type="submit"
            className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 hover:brightness-110 active:scale-95 transition-all duration-300"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>

      </div>

    </div>
  );
}

export default ChatRoom;

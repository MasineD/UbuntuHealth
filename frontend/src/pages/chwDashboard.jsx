import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, Clock, LogOut, Loader2, ShieldCheck, Bell, CheckCircle, User as UserIcon, Heart, Calendar, Activity, ClipboardList, MapPin, MessageSquare, Send } from 'lucide-react';
import { io } from 'socket.io-client';
import ChatRoom from '../components/ChatRoom';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function ChwDashboard({ user, onLogout, actionLoading }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'patients' | 'visits' | 'referrals'
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Socket & Notifications state
  const [socket, setSocket] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  useEffect(() => {
    let active = true;
    let socketInstance;

    const initSocket = async () => {
      try {
        const orgRes = await api.get('/auth/my-organization');
        if (!active) return;
        const orgName = orgRes.data.organization;
        if (!orgName) return;

        socketInstance = io('http://localhost:5000');
        
        socketInstance.on('connect', () => {
          socketInstance.emit('register-user', {
            userId: user.id,
            role: user.role,
            organization: orgName,
            staffRole: null
          });
        });

        socketInstance.on('new-notification', (data) => {
          const notificationData = {
            ...data,
            unread: true
          };
          setNotifications(prev => [notificationData, ...prev]);

          const newToast = {
            id: Date.now() + Math.random(),
            type: data.type === 'referral_created' ? 'referral' : 'appointment',
            title: data.title,
            message: data.message
          };
          setToasts(prev => [...prev, newToast]);

          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
          }, 5000);
        });

        socketInstance.on('new-message', (msg) => {
          const isFromSelf = msg.sender_id.toString() === user.id.toString() && msg.sender_role === user.role;
          if (!isFromSelf) {
            const notificationData = {
              type: 'message',
              title: `New Message from ${msg.sender_name}`,
              message: msg.message_text,
              timestamp: new Date().toISOString(),
              unread: true
            };
            setNotifications(prev => [notificationData, ...prev]);

            const newToast = {
              id: Date.now() + Math.random(),
              type: 'message',
              title: `New Message from ${msg.sender_name}`,
              message: msg.message_text.length > 60 ? msg.message_text.substring(0, 60) + '...' : msg.message_text
            };
            setToasts(prev => [...prev, newToast]);
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== newToast.id));
            }, 5000);
          }
        });

        setSocket(socketInstance);
      } catch (err) {
        console.error('Failed to initialize socket:', err);
      }
    };

    initSocket();

    return () => {
      active = false;
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [user]);

  // Referrals State
  const [referrals, setReferrals] = useState({ incoming: [], outgoing: [] });
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralModalLoading, setReferralModalLoading] = useState(false);
  const [referralModalError, setReferralModalError] = useState('');
  const [referralModalSuccess, setReferralModalSuccess] = useState('');
  const [chwOrganization, setChwOrganization] = useState('');
  const [orgStaffList, setOrgStaffList] = useState([]);
  const [orgPatientsList, setOrgPatientsList] = useState([]);

  // Search queries for referral modal selectors
  const [patientQuery, setPatientQuery] = useState('');
  const [deptQuery, setDeptQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');

  const [referralForm, setReferralForm] = useState({
    personel: '',
    organization_to: '',
    department_to: 'General Medicine',
    staff_to: '',
    reason: '',
    arrival_date: '',
    arrival_time: ''
  });

  const fetchReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const response = await api.get('/auth/referrals');
      if (response.data) {
        setReferrals({
          incoming: response.data.incoming || [],
          outgoing: response.data.outgoing || []
        });
      }
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const fetchChwOrganization = async () => {
    try {
      const response = await api.get('/auth/my-organization');
      if (response.data && response.data.organization) {
        setChwOrganization(response.data.organization);
        setReferralForm(prev => ({ ...prev, organization_to: response.data.organization }));
        
        // Also fetch the staff for this organization immediately, since CHWs can only refer to their own org!
        const staffRes = await api.get(`/auth/organizations/${encodeURIComponent(response.data.organization)}/staff`);
        if (staffRes.data && staffRes.data.staff) {
          setOrgStaffList(staffRes.data.staff);
        }
      }
    } catch (err) {
      console.error('Error fetching CHW organization:', err);
    }
  };

  const fetchOrganizationPatients = async () => {
    try {
      const response = await api.get('/auth/organization-patients');
      if (response.data && response.data.patients) {
        setOrgPatientsList(response.data.patients);
      }
    } catch (err) {
      console.error('Error fetching organization patients:', err);
    }
  };

  const handleCreateReferral = async (e) => {
    e.preventDefault();
    setReferralModalError('');
    setReferralModalSuccess('');
    setReferralModalLoading(true);

    try {
      // Force organization_to to match CHW's organization
      const payload = {
        ...referralForm,
        organization_to: chwOrganization
      };
      await api.post('/auth/referrals', payload);
      setReferralModalSuccess('Referral created successfully!');
      fetchReferrals();
      setReferralForm({
        personel: '',
        organization_to: chwOrganization,
        department_to: 'General Medicine',
        staff_to: '',
        reason: '',
        arrival_date: '',
        arrival_time: ''
      });
      setPatientQuery('');
      setDeptQuery('');
      setStaffQuery('');
      setTimeout(() => {
        closeReferralModal();
      }, 1500);
    } catch (err) {
      setReferralModalError(err.response?.data?.message || 'Failed to create referral');
    } finally {
      setReferralModalLoading(false);
    }
  };

  const closeReferralModal = () => {
    setIsReferralModalOpen(false);
    setReferralModalError('');
    setReferralModalSuccess('');
    setPatientQuery('');
    setDeptQuery('');
    setStaffQuery('');
  };

  // Simulated visits status
  const [visits, setVisits] = useState([
    { id: 1, patient: 'John Doe', task: 'Check Blood Pressure & Medication Compliance', time: '09:00 AM', status: 'Completed' },
    { id: 2, patient: 'Jane Smith', task: 'Administer insulin & check daily log', time: '11:30 AM', status: 'Pending' },
    { id: 3, patient: 'Zanele Ndlovu', task: 'Pregnancy nutrition & vitals follow-up', time: '02:00 PM', status: 'Pending' },
    { id: 4, patient: 'David Miller', task: 'Kidney diet routine review', time: '04:15 PM', status: 'Pending' }
  ]);

  const toggleVisitStatus = (id) => {
    setVisits(visits.map(v => {
      if (v.id === id) {
        return { ...v, status: v.status === 'Completed' ? 'Pending' : 'Completed' };
      }
      return v;
    }));
  };

  const calculateAgeFromId = (idNumber) => {
    if (!idNumber || idNumber.length !== 13) return 30;
    try {
      const yearStr = idNumber.substring(0, 2);
      const monthStr = idNumber.substring(2, 4);
      const dayStr = idNumber.substring(4, 6);
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return 30;
      
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      const birthYear = year + (year + 2000 > currentYear ? currentCentury - 100 : currentCentury);
      
      const birthDate = new Date(birthYear, month - 1, day);
      let age = currentYear - birthYear;
      const m = new Date().getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) {
        age--;
      }
      return isNaN(age) ? 30 : age;
    } catch (e) {
      return 30;
    }
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await api.get('/auth/chw/patients');
      if (response.data && response.data.patients) {
        setPatients(response.data.patients);
      }
    } catch (err) {
      console.error('Error fetching CHW patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchReferrals();
    fetchChwOrganization();
    fetchOrganizationPatients();
  }, []);

  const sidebarItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'patients', name: 'Assigned Patients', icon: Users },
    { id: 'visits', name: 'Daily Visits', icon: ClipboardList },
    { id: 'referrals', name: 'Referrals', icon: Calendar },
    { id: 'chat', name: 'Chat Room', icon: MessageSquare }
  ];

  const filteredPatients = orgPatientsList.filter(p => 
    p.fullname.toLowerCase().includes(patientQuery.toLowerCase())
  );
  const departments = ['General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Neurology', 'Endocrinology', 'Nephrology', 'Obstetrics & Gynecology', 'Psychiatry', 'Physical Therapy'];
  const filteredDepts = departments.filter(dept => 
    dept.toLowerCase().includes(deptQuery.toLowerCase())
  );
  const filteredStaff = orgStaffList.filter(s => 
    s.fullname.toLowerCase().includes(staffQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-full shrink-0 relative z-20">
        
        <div>
          {/* Top Branding Section */}
          <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="h-5 w-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              UbuntuHealth
            </span>
          </div>

          {/* User Details Block */}
          <div className="p-6 border-b border-slate-800/80 bg-slate-950/30">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-slate-800 flex items-center justify-center text-sm font-extrabold border border-slate-700 text-teal-400 shrink-0">
                {user.name ? user.name.split(' ').map(n=>n[0]).join('').toUpperCase() : 'CHW'}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-200 text-sm truncate">{user.name}</h3>
                <p className="text-slate-500 text-xs truncate mb-1">{user.email || 'No email registered'}</p>
                <span className="inline-block bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Health Worker
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Employee ID:</span>
              <span className="font-mono text-slate-400">{user.employee_id}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-teal-500/15 to-emerald-500/5 text-teal-400 border border-teal-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  {item.name}
                  {item.id === 'chat' && notifications.some(n => n.type === 'message') && (
                    <span className="ml-auto bg-teal-550 text-slate-950 rounded-full text-[10px] font-extrabold px-1.5 py-0.5 animate-pulse">
                      •
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <button
            onClick={onLogout}
            disabled={actionLoading}
            className="w-full py-3 bg-slate-950 border border-slate-800/80 hover:bg-red-950/30 hover:border-red-500/20 hover:text-red-400 text-slate-400 font-bold rounded-xl transition-all duration-300 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {actionLoading ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT SECTION ================= */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
        <div className="absolute top-[-15%] right-[-15%] w-[600px] h-[600px] bg-teal-950/10 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Top Header Bar */}
        <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide capitalize">
              {activeTab === 'patients' ? 'Assigned Facility Patients' : activeTab === 'visits' ? 'Daily Care Visits' : activeTab}
            </h1>
            <span className="text-xs text-slate-500 font-mono">| CHW Access</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Facility Secured
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors relative"
              >
                <Bell className="h-4.5 w-4.5" />
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-teal-500 text-slate-950 rounded-full text-[9px] font-extrabold h-4 w-4 flex items-center justify-center animate-pulse">
                    {notifications.filter(n => n.unread).length}
                  </span>
                )}
              </button>
              
              {showNotificationsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-850 rounded-2xl p-4 shadow-2xl z-50 text-left animate-slideIn">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-200">Alerts & Notifications</span>
                    <button 
                      onClick={() => setNotifications([])}
                      className="text-[10px] text-teal-400 hover:text-teal-350 font-semibold"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="mt-2.5 space-y-2.5 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-[11px] text-slate-500 text-center py-4 italic">No new notifications</p>
                    ) : (
                      notifications.map((n, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setNotifications(prev => prev.map((item, i) => i === idx ? { ...item, unread: false } : item));
                          }}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            n.unread 
                              ? 'bg-slate-900 border-slate-700/80 hover:bg-slate-850' 
                              : 'bg-slate-950/20 border-slate-900/50 opacity-60 hover:bg-slate-900/20'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1.5">
                              {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse shrink-0" />}
                              <span className="text-xs font-bold text-slate-300">{n.title}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed pl-3">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Inner CHW Pages */}
        <section className="flex-grow p-8 overflow-y-auto relative z-10 max-w-5xl w-full mx-auto">
          
          {/* ================= PAGE: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* CHW Welcome Banner */}
              <div className="bg-gradient-to-r from-teal-950/30 to-slate-900/30 border border-teal-500/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-100">Hello, {user.name.split(' ')[0]}</h2>
                  <p className="text-slate-400 text-xs">Track clinical routines and complete community visits for patients.</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold">
                  <CheckCircle className="h-4 w-4" /> Shift Active
                </div>
              </div>

              {/* Health stats block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: 'Total Patients', value: patients.length.toString(), desc: 'Under your facility care', icon: Users, color: 'text-rose-400 bg-rose-500/10 border-rose-500/25' },
                  { title: 'Visits Completed', value: `${visits.filter(v => v.status === 'Completed').length} / ${visits.length}`, desc: 'Shift progress', icon: Clock, color: 'text-teal-400 bg-teal-500/10 border-teal-500/25' },
                  { title: 'Active Facility Code', value: 'REG-ZA', desc: 'Secure identifier', icon: Calendar, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25' }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <span className="text-slate-500 text-xs font-semibold tracking-wide uppercase">{stat.title}</span>
                        <h3 className="text-lg font-bold text-white">{stat.value}</h3>
                        <p className="text-[11px] text-slate-400">{stat.desc}</p>
                      </div>
                      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${stat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid: Overview summaries */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left: Visits check list */}
                <div className="md:col-span-12 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <h3 className="font-bold text-slate-200">Today’s Patient Visits</h3>
                    <button 
                      onClick={() => setActiveTab('visits')}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      View Checklist
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {visits.slice(0, 3).map((v) => (
                      <div key={v.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleVisitStatus(v.id)}
                            className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                              v.status === 'Completed'
                                ? 'bg-teal-500 border-teal-500 text-slate-950 font-bold'
                                : 'border-slate-700 hover:border-teal-500/50 bg-slate-950'
                            }`}
                          >
                            {v.status === 'Completed' && <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                          <div>
                            <p className={`font-semibold text-sm ${v.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                              {v.patient}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">{v.task}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{v.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ================= PAGE: ASSIGNED PATIENTS ================= */}
          {activeTab === 'patients' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-200">Facility Patient Index</h3>
                <p className="text-slate-500 text-xs">Patients associated with your organization registrar</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Address Details</th>
                      <th className="py-3 px-4">National ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingPatients ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-550">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-teal-400" />
                          Loading patients index...
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-550">
                          No patients currently registered in your facility's jurisdiction.
                        </td>
                      </tr>
                    ) : (
                      patients.map((pt) => (
                        <tr key={pt.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {pt.fullname}
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">PT-{pt.id}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {pt.gender}, {calculateAgeFromId(pt.id_number)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-350">
                            <span className="block text-slate-200">{pt.phone_number}</span>
                            <span className="block text-xs text-slate-500">{pt.email || 'No email provided'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-xs">
                            <span className="block font-semibold text-slate-300">{pt.house_number} {pt.surbub}</span>
                            <span className="block text-slate-500">{pt.municipality}, {pt.city}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{pt.id_number}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= PAGE: DAILY VISITS ================= */}
          {activeTab === 'visits' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-200">Visits Checklist</h3>
                <p className="text-slate-500 text-xs">Monitor medication and routine checks for assigned patient visits</p>
              </div>

              <div className="divide-y divide-slate-800/80">
                {visits.map((v) => (
                  <div key={v.id} className="py-4.5 flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <button
                        onClick={() => toggleVisitStatus(v.id)}
                        className={`mt-0.5 h-6.5 w-6.5 rounded-lg border flex items-center justify-center transition-all ${
                          v.status === 'Completed'
                            ? 'bg-teal-500 border-teal-500 text-slate-950 font-extrabold'
                            : 'border-slate-700 hover:border-teal-500/50 bg-slate-950'
                        }`}
                      >
                        {v.status === 'Completed' && <CheckCircle className="h-4.5 w-4.5" />}
                      </button>
                      <div>
                        <p className={`font-bold text-sm ${v.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {v.patient}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-500" />
                          {v.task}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-500 font-mono block">{v.time}</span>
                      <span className={`inline-block text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full mt-1.5 ${
                        v.status === 'Completed' ? 'bg-teal-500/10 text-teal-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= PAGE: REFERRALS ================= */}
          {activeTab === 'referrals' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Outgoing Referrals</h3>
                  <p className="text-slate-500 text-xs">Referrals you have made to {chwOrganization}</p>
                </div>
                <button 
                  onClick={() => { setIsReferralModalOpen(true); fetchOrganizationPatients(); }}
                  className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Create Referral
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Target Organization</th>
                      <th className="py-3 px-4">Department & Destination</th>
                      <th className="py-3 px-4">Arrival Date / Time</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingReferrals ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading referrals...
                        </td>
                      </tr>
                    ) : referrals.outgoing.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          No referrals created by you yet.
                        </td>
                      </tr>
                    ) : (
                      referrals.outgoing.map((ref) => (
                        <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {ref.personel}
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Ref ID: #{ref.id}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-semibold">
                            {ref.organization_to}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className="block text-slate-200">{ref.department_to}</span>
                            <span className="block text-slate-400 mt-0.5">Recipient: {ref.staff_to || 'Organization Admin'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-355 font-normal">
                            {ref.arrival_date ? ref.arrival_date.split('T')[0] : 'N/A'}
                            <span className="block text-slate-500 mt-0.5">{ref.arrival_time || ''}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              ref.status ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}>
                              {ref.status ? 'Attended' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= PAGE: CHAT ROOM ================= */}
          {activeTab === 'chat' && (
            <ChatRoom user={user} socket={socket} />
          )}

        </section>
      </main>

      {/* ================= CREATE REFERRAL MODAL ================= */}
      {isReferralModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={closeReferralModal}
              className="absolute top-4 right-4 text-slate-550 hover:text-slate-355 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Create New Referral</h2>
              <p className="text-slate-400 text-xs mt-1">Initiate a transfer to your registered organization.</p>
            </div>

            {/* Error & Success Notification */}
            {referralModalError && (
              <div className="bg-red-950/40 border border-red-500/25 text-red-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{referralModalError}</span>
              </div>
            )}
            {referralModalSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{referralModalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateReferral} className="space-y-4">
              {/* Patient Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-semibold">Select Patient *</label>
                  <input 
                    type="text" 
                    placeholder="Search patient by name..." 
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-650 outline-none focus:border-emerald-500 w-48 transition-colors"
                  />
                </div>
                <select
                  required
                  value={referralForm.personel}
                  onChange={(e) => setReferralForm({...referralForm, personel: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">-- Choose Patient --</option>
                  {filteredPatients.map(p => (
                    <option key={p.id} value={`${p.fullname} (${p.id_number})`}>
                      {p.fullname} ({p.id_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Destination Organization (Locked) */}
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Target Organization (Locked) *</label>
                  <input
                    type="text"
                    disabled
                    value={chwOrganization}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-400 outline-none"
                  />
                </div>

                {/* Target Department */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 font-semibold">Department To *</label>
                    <input 
                      type="text" 
                      placeholder="Search department..." 
                      value={deptQuery}
                      onChange={e => setDeptQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-650 outline-none focus:border-emerald-500 w-32 transition-colors"
                    />
                  </div>
                  <select
                    required
                    value={referralForm.department_to}
                    onChange={(e) => setReferralForm({...referralForm, department_to: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  >
                    {filteredDepts.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Staff Member (Optional) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-slate-400 font-semibold">Target Clinician / Staff member (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Search staff by name..." 
                    value={staffQuery}
                    onChange={e => setStaffQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-650 outline-none focus:border-emerald-500 w-48 transition-colors"
                  />
                </div>
                <select
                  value={referralForm.staff_to}
                  onChange={(e) => setReferralForm({...referralForm, staff_to: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">-- Defaults to Organization Admin --</option>
                  {filteredStaff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullname} ({s.staff_role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Arrival Date */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Estimated Arrival Date *</label>
                  <input
                    type="date"
                    required
                    value={referralForm.arrival_date}
                    onChange={(e) => setReferralForm({...referralForm, arrival_date: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Arrival Time */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Estimated Arrival Time</label>
                  <input
                    type="time"
                    value={referralForm.arrival_time}
                    onChange={(e) => setReferralForm({...referralForm, arrival_time: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Referral Reason */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">Reason for Referral *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the symptoms, diagnosis, or reason for transfer..."
                  value={referralForm.reason}
                  onChange={(e) => setReferralForm({...referralForm, reason: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeReferralModal}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={referralModalLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {referralModalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {referralModalLoading ? 'Creating Referral...' : 'Create Referral'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 animate-slideIn">
            <div className={`p-2 rounded-xl shrink-0 ${
              toast.type === 'message' 
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                : toast.type === 'referral' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
            }`}>
              {toast.type === 'message' ? <MessageSquare className="h-4 w-4" /> : toast.type === 'referral' ? <Activity className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-200">{toast.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-500 hover:text-slate-350 transition-colors text-sm font-bold align-top leading-none"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default ChwDashboard;

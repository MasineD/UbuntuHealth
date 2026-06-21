import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, FileText, Clock, Phone, LogOut, Loader2,ShieldCheck,Bell,CheckCircle,User as UserIcon,Activity,Heart,ChevronRight, Calendar, CalendarDays, Plus, MessageSquare, Send, X, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';
import ChatRoom from '../components/ChatRoom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function PatientDashboard({ user, onLogout, actionLoading, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'records' | 'routines' | 'contacts' | 'referrals' | 'appointments'
  const [referralsList, setReferralsList] = useState([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({
    fullname: '',
    gender: '',
    email: '',
    phone_number: '',
    house_number: '',
    surbub: '',
    municipality: '',
    city: '',
    next_of_kin_fullname: '',
    next_of_kin_email: '',
    next_of_kin_phone: ''
  });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await api.get('/auth/profile');
      if (res.data && res.data.profile) {
        setProfileData(res.data.profile);
        setProfileForm({
          fullname: res.data.profile.fullname || '',
          gender: res.data.profile.gender || '',
          email: res.data.profile.email || '',
          phone_number: res.data.profile.phone_number || '',
          house_number: res.data.profile.house_number || '',
          surbub: res.data.profile.surbub || '',
          municipality: res.data.profile.municipality || '',
          city: res.data.profile.city || '',
          next_of_kin_fullname: res.data.profile.next_of_kin_fullname || '',
          next_of_kin_email: res.data.profile.next_of_kin_email || '',
          next_of_kin_phone: res.data.profile.next_of_kin_phone || ''
        });
      }
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to load profile details');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (isProfileModalOpen) {
      fetchProfile();
      setIsEditingProfile(false);
      setProfileSuccess('');
      setProfileError('');
    }
  }, [isProfileModalOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await api.put('/auth/profile', profileForm);
      if (res.data && res.data.profile) {
        setProfileData(res.data.profile);
        setProfileSuccess('Profile updated successfully!');
        setIsEditingProfile(false);
        if (onUserUpdate && res.data.user) {
          onUserUpdate(res.data.user);
        }
      }
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to save profile changes');
    } finally {
      setProfileSaving(false);
    }
  };

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

        socketInstance = io(`${API_URL}`);
        
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
            type: data.type === 'medication' ? 'medication' : (data.type === 'referral_created' ? 'referral' : 'appointment'),
            title: data.title,
            message: data.message
          };
          setToasts(prev => [...prev, newToast]);

          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
          }, 5000);

          if (data.type === 'medication') {
            fetchMedicationLogs();
          }
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

  // Appointments State
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Searchable Selectors and Form States
  const [organizations, setOrganizations] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [orgQuery, setOrgQuery] = useState('');
  const [deptQuery, setDeptQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');

  const [bookingForm, setBookingForm] = useState({
    organization_to: '',
    department_to: 'General Medicine',
    staff_to: '',
    arrival_date: '',
    arrival_time: '',
    reason: ''
  });

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  const fetchReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const response = await api.get('/auth/referrals');
      if (response.data && response.data.incoming) {
        setReferralsList(response.data.incoming); // For patient, all their referrals are returned in incoming
      }
    } catch (err) {
      console.error('Error fetching patient referrals:', err);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const response = await api.get('/auth/appointments');
      if (response.data && response.data.appointments) {
        setAppointments(response.data.appointments);
      }
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/auth/organizations');
      if (res.data && res.data.organizations) {
        setOrganizations(res.data.organizations);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  };

  const handleOrgChange = async (orgName) => {
    setBookingForm(prev => ({ ...prev, organization_to: orgName, staff_to: '' }));
    setStaffList([]);
    setStaffQuery('');
    
    if (!orgName) return;

    try {
      const res = await api.get(`/auth/organizations/${encodeURIComponent(orgName)}/staff`);
      if (res.data && res.data.staff) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.error('Error fetching staff members:', err);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');
    setBookingLoading(true);

    try {
      const res = await api.post(`/auth/appointments`, {
        fullname: user.name || user.fullname,
        phone_number: user.phone_number,
        ...bookingForm
      });
      const keyMsg = res.data.appointment?.appointment_key ? ` Verification Key: ${res.data.appointment.appointment_key}` : '';
      setBookingSuccess((res.data.message || 'Appointment requested successfully!') + keyMsg);
      // Reset form
      setBookingForm({
        organization_to: '',
        department_to: 'General Medicine',
        staff_to: '',
        arrival_date: '',
        arrival_time: '',
        reason: ''
      });
      setOrgQuery('');
      setDeptQuery('');
      setStaffQuery('');
      setStaffList([]);
      
      // Reload appointments list
      fetchAppointments();
      
      // Close modal after a short delay
      setTimeout(() => {
        setShowModal(false);
        setBookingSuccess('');
      }, 1500);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Failed to request appointment. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const [medicationLogs, setMedicationLogs] = useState([]);

  const fetchMedicationLogs = async () => {
    try {
      const response = await api.get('/auth/patients/my-medications');
      if (response.data && response.data.medicationLogs) {
        setMedicationLogs(response.data.medicationLogs);
      }
    } catch (err) {
      console.error('Error fetching medication logs:', err);
    }
  };

  const handleToggleMedication = async (logId) => {
    try {
      const response = await api.post(`auth/patients/my-medications/${logId}/toggle`);
      if (response.data) {
        setMedicationLogs(prev => prev.map(log => 
          log.id === logId ? { ...log, taken: response.data.taken } : log
        ));
      }
    } catch (err) {
      console.error('Error toggling medication log:', err);
    }
  };

  useEffect(() => {
    fetchReferrals();
    fetchAppointments();
    fetchOrganizations();
    fetchMedicationLogs();
  }, []);
  
  // Simulated Patient Routines
  const [routines, setRoutines] = useState([
    { id: 1, time: '08:00 AM', task: 'Take Blood Pressure Medication (1x pill)', status: 'Completed' },
    { id: 2, time: '12:00 PM', task: 'Check Blood Glucose Levels (post-lunch)', status: 'Pending' },
    { id: 3, time: '06:00 PM', task: 'insulin Injection (15 Units)', status: 'Pending' },
    { id: 4, time: '09:00 PM', task: 'Take Cholesterol Medication (1x pill)', status: 'Pending' }
  ]);

  const toggleRoutineStatus = (id) => {
    setRoutines(routines.map(r => {
      if (r.id === id) {
        return { ...r, status: r.status === 'Completed' ? 'Pending' : 'Completed' };
      }
      return r;
    }));
  };

  // Simulated Medical Records
  const medicalRecords = [
    { date: '2026-06-18', facility: 'UbuntuHealth General Hospital', clinician: 'Dr. Sarah Jenkins', reason: 'Lipid Panel & Glucose Check', diagnosis: 'Normal lipid profile, HbA1c stable at 6.4%' },
    { date: '2026-05-15', facility: 'UbuntuHealth General Hospital', clinician: 'Dr. Sarah Jenkins', reason: 'Hypertension Routine Follow-up', diagnosis: 'BP reading 128/82. Continue daily dosage.' },
    { date: '2026-03-10', facility: 'Midwife Center C', clinician: 'Dr. Winnie Mandela', reason: 'General Health Assessment', diagnosis: 'Overall health stable. Recommended routine diet adjustments.' }
  ];

  const sidebarItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    // { id: 'records', name: 'Medical Records', icon: FileText },
    { id: 'routines', name: 'Daily Routines', icon: Clock },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'referrals', name: 'My Referrals', icon: ChevronRight },
    // { id: 'contacts', name: 'Contacts', icon: Phone },
    { id: 'chat', name: 'Chat Room', icon: MessageSquare }
  ];

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-full shrink-0 relative z-20">
        
        {/* Top Branding Section */}
        <div>
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
                {user.name ? user.name.split(' ').map(n=>n[0]).join('').toUpperCase() : 'PT'}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-200 text-sm truncate">{user.name}</h3>
                <p className="text-slate-500 text-xs truncate mb-1">{user.email || 'No email registered'}</p>
                <span className="inline-block bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Patient
                </span>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="mt-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold underline block text-left transition-colors duration-200"
                >
                  View Profile
                </button>
              </div>
            </div>
            {/* ID Number display */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500 flex justify-between items-center">
              <span>National ID:</span>
              <span className="font-mono text-slate-400">{user.id_number}</span>
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
                    <span className="ml-auto bg-teal-500 text-slate-950 rounded-full text-[10px] font-extrabold px-1.5 py-0.5 animate-pulse">
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
        <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md relative z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide capitalize">
              {activeTab === 'records' 
                ? 'Medical Records History' 
                : activeTab === 'routines' 
                  ? 'Daily Medication & Routines' 
                  : activeTab === 'appointments'
                    ? 'My Scheduled Appointments'
                    : activeTab === 'referrals'
                      ? 'My Referrals'
                      : activeTab}
            </h1>
            <span className="text-xs text-slate-500 font-mono">| Patient Access</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Patient HIPAA Secured
            </div>
            
            {/* Notification Badge */}
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
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-850 rounded-2xl p-4 shadow-2xl text-left animate-slideIn">
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

        {/* Dynamic Inner Patient Pages */}
        <section className="flex-grow p-8 overflow-y-auto relative z-10 max-w-5xl w-full mx-auto">
          
          {/* ================= PAGE: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Patient Welcome Banner */}
              <div className="bg-gradient-to-r from-teal-950/30 to-slate-900/30 border border-teal-500/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-100">Hello, {user.name.split(' ')[0]}</h2>
                  <p className="text-slate-400 text-xs">Stay on track with your routines, consultations, and medical records.</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold">
                  <CheckCircle className="h-4 w-4" /> Active Health Plan
                </div>
              </div>

              {/* Health stats block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: 'Blood Pressure', value: '128 / 82 mmHg', desc: 'Normal (Last checked June 18)', icon: Heart, color: 'text-rose-400 bg-rose-500/10 border-rose-500/25' },
                  { title: 'Completed Routines', value: `${routines.filter(r => r.status === 'Completed').length} / ${routines.length}`, desc: 'Keep it up!', icon: Clock, color: 'text-teal-400 bg-teal-500/10 border-teal-500/25' },
                  { title: 'Next Consultation', value: 'Today at 02:00 PM', desc: 'Dr. Sarah Jenkins (Cardiology)', icon: Calendar, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25' }
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
                
                {/* Left: Routines check list */}
                <div className="md:col-span-15 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <h3 className="font-bold text-slate-200">Routines for Today</h3>
                    <button 
                      onClick={() => setActiveTab('routines')}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      Manage Routines
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Render active medication logs */}
                    {medicationLogs.map((log) => (
                      <div key={`med-${log.id}`} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-slate-200">Take Medication</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Scheduled for {log.scheduled_time ? log.scheduled_time.substring(0, 5) : ''} ({log.medication_time})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`chk-med-${log.id}`}
                            checked={log.taken}
                            onChange={() => handleToggleMedication(log.id)}
                            className="w-4 h-4 accent-teal-500 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 cursor-pointer"
                          />
                          <label htmlFor={`chk-med-${log.id}`} className="text-xs text-slate-400 select-none cursor-pointer">
                            {log.taken ? 'Taken' : 'Mark Taken'}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Last medical reports summary */}
                {/* <div className="md:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <h3 className="font-bold text-slate-200">Latest Diagnosis</h3>
                    <button 
                      onClick={() => setActiveTab('records')}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      History
                    </button>
                  </div>

                  {medicalRecords.slice(0, 1).map((record, i) => (
                    <div key={i} className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-500 font-mono">{record.date}</span>
                        <h4 className="text-sm font-bold text-slate-200 mt-1">{record.clinician}</h4>
                        <p className="text-xs text-slate-400">{record.facility}</p>
                      </div>
                      <div className="p-3.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
                        <strong>Reason:</strong> {record.reason}<br />
                        <strong className="block mt-1.5 text-teal-400">Diagnosis/Notes:</strong> {record.diagnosis}
                      </div>
                    </div>
                  ))}
                </div> */}

              </div>

            </div>
          )}

          {/* ================= PAGE: RECORDS ================= */}
          {activeTab === 'records' && (
            <div className="space-y-5">
              {medicalRecords.map((record, idx) => (
                <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 font-mono text-xs px-2 py-0.5 rounded">
                        {record.date}
                      </span>
                      <span className="text-slate-500 text-xs font-semibold">| Verified Diagnosis</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{record.reason}</h3>
                    <p className="text-slate-400 text-xs">{record.clinician} · {record.facility}</p>
                    <p className="text-sm text-slate-300 bg-slate-950/50 p-4 border border-slate-850 rounded-xl max-w-3xl leading-relaxed">
                      {record.diagnosis}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= PAGE: ROUTINES ================= */}
          {activeTab === 'routines' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-200">Daily Routines & Meds</h3>
                <p className="text-slate-500 text-xs">Verify your clinician prescribed daily routines by marking them complete.</p>
              </div>

              <div className="divide-y divide-slate-800/80">
                {/* Render active medication logs */}
                {medicationLogs.map((log) => (
                  <div key={`med-tab-${log.id}`} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4.5 w-4.5 text-rose-400" />
                        <span className="font-bold text-slate-200 text-sm">
                          {log.scheduled_time ? log.scheduled_time.substring(0, 5) : ''}
                        </span>
                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                          {log.medication_time}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs pl-6">Take Medication</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`chk-med-tab-${log.id}`}
                        checked={log.taken}
                        onChange={() => handleToggleMedication(log.id)}
                        className="w-4 h-4 accent-teal-500 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 cursor-pointer"
                      />
                      <label htmlFor={`chk-med-tab-${log.id}`} className="text-xs text-slate-400 select-none cursor-pointer">
                        {log.taken ? 'Taken' : 'Mark Taken'}
                      </label>
                    </div>
                  </div>
                ))}

                {/* {routines.map((r) => (
                  <div key={r.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4.5 w-4.5 text-teal-400" />
                        <span className="font-bold text-slate-200 text-sm">{r.time}</span>
                      </div>
                      <p className="text-slate-400 text-xs pl-6">{r.task}</p>
                    </div>
                    <button
                      onClick={() => toggleRoutineStatus(r.id)}
                      className={`text-xs font-bold py-2 px-4 rounded-xl border transition-all duration-300 ${
                        r.status === 'Completed' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {r.status}
                    </button>
                  </div>
                ))} */}
              </div>
            </div>
          )}

          {/* ================= PAGE: CONTACTS ================= */}
          {activeTab === 'contacts' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Primary Medical Contacts */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-3">Primary Clinician</h3>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-teal-400">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Dr. Sarah Jenkins</h4>
                      <p className="text-slate-500 text-xs">Primary Cardiologist</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <p><strong>Facility:</strong> UbuntuHealth General Hospital</p>
                    <p><strong>Consultation Days:</strong> Mon, Wed, Fri</p>
                    <p><strong>Primary Clinic Contact:</strong> +27 11 892 0192</p>
                  </div>
                </div>
              </div>

              {/* Next of Kin details */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-3">Registered Next of Kin</h3>
                <div className="space-y-4 pt-2 text-xs text-slate-400">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">FULL NAME</span>
                    <p className="font-bold text-slate-200 text-sm">Thabo Doe</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">PHONE NUMBER</span>
                      <p className="font-mono text-slate-200">082 123 4567</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase">EMAIL ADDRESS</span>
                      <p className="text-slate-200">thabo@kin.com</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ================= PAGE: MY REFERRALS ================= */}
          {activeTab === 'referrals' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-200">My Medical Referrals</h3>
                <p className="text-slate-500 text-xs">Medical transfers and checkups scheduled for you across facilities</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Referral ID</th>
                      <th className="py-3 px-4">Destination Facility</th>
                      <th className="py-3 px-4">Department & Clinician</th>
                      <th className="py-3 px-4">Estimated Arrival</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Verification Key</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingReferrals ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading referrals...
                        </td>
                      </tr>
                    ) : referralsList.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          No referrals registered for you.
                        </td>
                      </tr>
                    ) : (
                      referralsList.map((ref) => (
                        <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-400">#{ref.id}</td>
                          <td className="py-3.5 px-4 text-slate-200 font-bold">{ref.organization_to}</td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className="block text-slate-300">{ref.department_to}</span>
                            <span className="block text-slate-500 mt-0.5">Recipient: {ref.staff_to || 'Organization Admin'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-350">
                            {ref.arrival_date ? ref.arrival_date.split('T')[0] : 'N/A'}
                            <span className="block text-slate-500 mt-0.5">{ref.arrival_time || ''}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">{ref.reason}</td>
                          <td className="py-3.5 px-4 font-mono text-xs text-emerald-400 font-bold">
                            {ref.referral_key || 'N/A'}
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

          {/* ================= PAGE: APPOINTMENTS ================= */}
          {activeTab === 'appointments' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
                <div>
                  <h3 className="font-bold text-slate-200 text-lg">My Scheduled Appointments</h3>
                  <p className="text-slate-500 text-xs mt-1">Track and manage your medical consultations and bookings.</p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  <Plus className="h-4.5 w-4.5 stroke-[2.5]" /> Book Appointment
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-4">Ref ID</th>
                      <th className="py-3 px-4">Medical Facility</th>
                      <th className="py-3 px-4">Department & Staff</th>
                      <th className="py-3 px-4">Scheduled Date</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Verification Key</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingAppointments ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading appointments...
                        </td>
                      </tr>
                    ) : appointments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500 text-xs">
                          You haven't requested any appointments yet. Click "Book Appointment" to start.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((app) => {
                        let statusColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                        if (app.status === 'approved') statusColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        if (app.status === 'rejected') statusColor = 'bg-red-500/10 text-red-400 border border-red-500/20';
                        if (app.status === 'attended') statusColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
                        
                        return (
                          <tr key={app.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-500">#{app.id}</td>
                            <td className="py-3.5 px-4 text-slate-200 font-bold">{app.organization_to}</td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="block text-slate-350">{app.department_to}</span>
                              <span className="block text-slate-500 mt-0.5">Staff: {app.staff_to || 'Facility Admin'}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                              {app.arrival_date ? app.arrival_date.split('T')[0] : 'N/A'}
                              <span className="block text-slate-500 mt-0.5">{app.arrival_time || 'No preferred time'}</span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">{app.reason}</td>
                            <td className="py-3.5 px-4 font-mono text-xs text-emerald-400 font-bold">
                              {app.appointment_key || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                {app.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
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

      {/* ================= PROFILE MODAL ================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Profile Details</h2>
              <p className="text-slate-400 text-xs mt-1">Manage and view your user profile details.</p>
            </div>

            {profileLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-teal-500 animate-spin mb-2" />
                <p className="text-xs text-slate-400">Loading profile details...</p>
              </div>
            ) : profileError ? (
              <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-200">Error</h4>
                  <p className="text-xs text-red-400 mt-1">{profileError}</p>
                  <button 
                    type="button"
                    onClick={fetchProfile}
                    className="mt-2 text-xs font-semibold text-teal-400 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {profileSuccess && (
                  <div className="p-4 bg-teal-950/30 border border-teal-500/20 rounded-2xl flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-teal-400 shrink-0" />
                    <p className="text-xs text-teal-300 font-semibold">{profileSuccess}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          disabled={!isEditingProfile}
                          value={profileForm.fullname}
                          onChange={(e) => setProfileForm({ ...profileForm, fullname: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-medium transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Gender</label>
                        <select
                          required
                          disabled={!isEditingProfile}
                          value={profileForm.gender}
                          onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-medium transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Address */}
                  <div className="space-y-4 pt-4 border-t border-slate-800/80">
                    <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Contact & Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Email Address</label>
                        <input
                          type="email"
                          disabled={!isEditingProfile}
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Phone Number</label>
                        <input
                          type="text"
                          required
                          disabled={!isEditingProfile}
                          value={profileForm.phone_number}
                          onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">House Number</label>
                        <input
                          type="text"
                          disabled={!isEditingProfile}
                          value={profileForm.house_number}
                          onChange={(e) => setProfileForm({ ...profileForm, house_number: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Suburb</label>
                        <input
                          type="text"
                          disabled={!isEditingProfile}
                          value={profileForm.surbub}
                          onChange={(e) => setProfileForm({ ...profileForm, surbub: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Municipality</label>
                        <input
                          type="text"
                          disabled={!isEditingProfile}
                          value={profileForm.municipality}
                          onChange={(e) => setProfileForm({ ...profileForm, municipality: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">City</label>
                        <input
                          type="text"
                          disabled={!isEditingProfile}
                          value={profileForm.city}
                          onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Next of Kin */}
                  <div className="space-y-4 pt-4 border-t border-slate-800/80">
                    <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Next of Kin details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Next of Kin Full Name</label>
                        <input
                          type="text"
                          required
                          disabled={!isEditingProfile}
                          value={profileForm.next_of_kin_fullname}
                          onChange={(e) => setProfileForm({ ...profileForm, next_of_kin_fullname: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-medium transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Next of Kin Phone</label>
                        <input
                          type="text"
                          required
                          disabled={!isEditingProfile}
                          value={profileForm.next_of_kin_phone}
                          onChange={(e) => setProfileForm({ ...profileForm, next_of_kin_phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Next of Kin Email</label>
                        <input
                          type="email"
                          disabled={!isEditingProfile}
                          value={profileForm.next_of_kin_email}
                          onChange={(e) => setProfileForm({ ...profileForm, next_of_kin_email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Systemic Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-555 block font-semibold uppercase mb-1">Identity Number (Uneditable)</span>
                      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-mono select-none">
                        {profileData?.id_number || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-555 block font-semibold uppercase mb-1">Organization (Uneditable)</span>
                      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-medium select-none">
                        {profileData?.organization || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  {isEditingProfile ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingProfile(false);
                          setProfileForm({
                            fullname: profileData?.fullname || '',
                            gender: profileData?.gender || '',
                            email: profileData?.email || '',
                            phone_number: profileData?.phone_number || '',
                            house_number: profileData?.house_number || '',
                            surbub: profileData?.surbub || '',
                            municipality: profileData?.municipality || '',
                            city: profileData?.city || '',
                            next_of_kin_fullname: profileData?.next_of_kin_fullname || '',
                            next_of_kin_email: profileData?.next_of_kin_email || '',
                            next_of_kin_phone: profileData?.next_of_kin_phone || ''
                          });
                          setProfileError('');
                          setProfileSuccess('');
                        }}
                        className="px-5 py-2.5 bg-slate-880 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all duration-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20"
                      >
                        {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-2.5 bg-slate-850 border border-slate-700/60 hover:bg-slate-800 text-teal-400 font-bold rounded-xl text-sm transition-all duration-300"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* ================= BOOKING MODAL ================= */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto relative shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Book New Appointment</h3>
                <p className="text-slate-500 text-xs mt-1">Fill in the fields below to schedule a clinician visit</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setBookingError('');
                  setBookingSuccess('');
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors text-sm font-bold bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notifications */}
            {bookingError && (
              <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs">
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs">
                <span>{bookingSuccess}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              
              {/* Patient Locked Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Patient Name</span>
                  <span className="text-slate-300 text-xs font-semibold">{user.name || user.fullname}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Phone Number</span>
                  <span className="text-slate-300 text-xs font-mono">{user.phone_number || 'N/A'}</span>
                </div>
              </div>

              {/* Destination Organization */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Organization *</label>
                  {/* <input 
                    type="text" 
                    placeholder="Filter organizations..." 
                    value={orgQuery}
                    onChange={e => setOrgQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] text-slate-300 placeholder-slate-500 outline-none focus:border-emerald-500/50 w-36 transition-colors"
                  /> */}
                </div>
                <select
                  required
                  value={bookingForm.organization_to}
                  onChange={e => handleOrgChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-105 outline-none transition-all"
                >
                  <option value="">-- Select Medical Facility --</option>
                  {organizations
                    .filter(org => org.toLowerCase().includes(orgQuery.toLowerCase()))
                    .map(org => (
                      <option key={org} value={org}>{org}</option>
                    ))
                  }
                </select>
              </div>

              {/* Target Department */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Department *</label>
                  {/* <input 
                    type="text" 
                    placeholder="Filter departments..." 
                    value={deptQuery}
                    onChange={e => setDeptQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] text-slate-300 placeholder-slate-500 outline-none focus:border-emerald-500/50 w-36 transition-colors"
                  /> */}
                </div>
                <select
                  required
                  value={bookingForm.department_to}
                  onChange={e => setBookingForm({ ...bookingForm, department_to: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-105 outline-none transition-all"
                >
                  {[
                    'General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Dermatology', 
                    'Neurology', 'Endocrinology', 'Nephrology', 'Obstetrics & Gynecology', 
                    'Psychiatry', 'Physical Therapy'
                  ]
                    .filter(dept => dept.toLowerCase().includes(deptQuery.toLowerCase()))
                    .map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))
                  }
                </select>
              </div>

              {/* Clinician / Staff member */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Clinician (Optional)</label>
                  {/*<input 
                    type="text" 
                    placeholder="Filter clinicians..." 
                    value={staffQuery}
                    onChange={e => setStaffQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-[10px] text-slate-300 placeholder-slate-500 outline-none focus:border-emerald-500/50 w-44 transition-colors"
                  />*/}
                </div>
                <select
                  value={bookingForm.staff_to}
                  onChange={e => setBookingForm({ ...bookingForm, staff_to: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-105 outline-none transition-all disabled:opacity-50"
                  disabled={!bookingForm.organization_to}
                >
                  <option value="">-- Choose Staff Member (Defaults to Facility Admin) --</option>
                  {staffList
                    .filter(s => s.fullname.toLowerCase().includes(staffQuery.toLowerCase()))
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullname} ({s.staff_role})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Arrival Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Date *</label>
                  <input
                    type="date"
                    required
                    value={bookingForm.arrival_date}
                    onChange={e => setBookingForm({ ...bookingForm, arrival_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-2.5 px-3 text-xs text-slate-100 outline-none transition-all"
                  />
                </div>

                {/* Arrival Time */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Preferred Time</label>
                  <input
                    type="time"
                    value={bookingForm.arrival_time}
                    onChange={e => setBookingForm({ ...bookingForm, arrival_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-2.5 px-3 text-xs text-slate-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Reason for Booking *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="State symptoms, consultation needs, or medication refill details..."
                  value={bookingForm.reason}
                  onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={bookingLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-bold text-xs tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {bookingLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
                {bookingLoading ? 'Requesting...' : 'Request Slot'}
              </button>
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
                  : toast.type === 'medication'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
            }`}>
              {toast.type === 'message' ? (
                <MessageSquare className="h-4 w-4" />
              ) : toast.type === 'referral' ? (
                <Activity className="h-4 w-4" />
              ) : toast.type === 'medication' ? (
                <Clock className="h-4 w-4" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
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

export default PatientDashboard;

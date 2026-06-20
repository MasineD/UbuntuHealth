import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, Calendar, ArrowLeftRight, MessageSquare, LogOut, Loader2,ShieldCheck,Search,Bell,Plus,Send,User as UserIcon,CheckCircle,FileText,Clock,Menu,ChevronRight
} from 'lucide-react';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function Dashboard({ user, onLogout, actionLoading }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'patients' | 'appointments' | 'referrals' | 'chat'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat Room state simulation
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'Dr. Sarah Jenkins', role: 'Cardiologist', text: 'Has patient John Doe completed his routine blood work?', time: '09:30 AM' },
    { id: 2, sender: 'You', role: 'Super Admin', text: 'Yes, John Doe’s lipid panel results are uploaded in records.', time: '09:35 AM' },
    { id: 3, sender: 'Dr. Sarah Jenkins', role: 'Cardiologist', text: 'Perfect. I will review them before our 2 PM appointment.', time: '09:37 AM' },
    { id: 4, sender: 'Chw. Musa Dube', role: 'Community Health Worker', text: 'Visited patient Jane Smith today. Routine checks are normal, medication tasks completed.', time: '10:15 AM' }
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = {
      id: chatMessages.length + 1,
      sender: 'You',
      role: 'Super Admin',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages([...chatMessages, msg]);
    setNewMessage('');
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

  // State to hold retrieved patients
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await api.get('/auth/patients');
      if (response.data && response.data.patients) {
        const mapped = response.data.patients.map(p => ({
          id: 'PT-' + p.id,
          name: p.fullname,
          age: calculateAgeFromId(p.id_number),
          gender: p.gender,
          condition: 'Regular Patient',
          status: 'Stable',
          chw: 'Unassigned',
          lastCheck: new Date().toISOString().split('T')[0],
          ...p
        }));
        setPatients(mapped);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  // CHWs state
  const [chws, setChws] = useState([]);
  const [loadingChws, setLoadingChws] = useState(false);
  const [isChwModalOpen, setIsChwModalOpen] = useState(false);
  const [chwModalLoading, setChwModalLoading] = useState(false);
  const [chwModalError, setChwModalError] = useState('');
  const [chwModalSuccess, setChwModalSuccess] = useState('');

  const [chwForm, setChwForm] = useState({
    employee_id: '',
    fullname: '',
    id_number: '',
    gender: 'Male',
    password: '',
    email: '',
    phone_number: '',
    house_number: '',
    surbub: '',
    municipality: '',
    city: ''
  });

  const fetchChws = async () => {
    setLoadingChws(true);
    try {
      const response = await api.get('/auth/chws');
      if (response.data && response.data.chws) {
        setChws(response.data.chws);
      }
    } catch (err) {
      console.error('Error fetching CHWs:', err);
    } finally {
      setLoadingChws(false);
    }
  };

  const handleRegisterChw = async (e) => {
    e.preventDefault();
    setChwModalError('');
    setChwModalSuccess('');
    
    if (chwForm.id_number.length !== 13) {
      setChwModalError('National ID must be exactly 13 digits');
      return;
    }
    if (chwForm.phone_number.length !== 10) {
      setChwModalError('Phone number must be exactly 10 digits');
      return;
    }

    setChwModalLoading(true);
    try {
      const response = await api.post('/auth/register-chw', chwForm);
      if (response.data && response.data.chw) {
        setChwModalSuccess('Community health worker registered successfully!');
        
        // Add new CHW to state list
        const newChw = response.data.chw;
        setChws([
          ...chws,
          {
            ...chwForm,
            id: newChw.id
          }
        ]);

        // Reset form
        setChwForm({
          employee_id: '',
          fullname: '',
          id_number: '',
          gender: 'Male',
          password: '',
          email: '',
          phone_number: '',
          house_number: '',
          surbub: '',
          municipality: '',
          city: ''
        });

        // Close modal after 1.5s
        setTimeout(() => {
          setIsChwModalOpen(false);
          setChwModalSuccess('');
        }, 1500);
      }
    } catch (err) {
      setChwModalError(err.response?.data?.message || 'Failed to register CHW');
    } finally {
      setChwModalLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchChws();
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  
  const [patientForm, setPatientForm] = useState({
    fullname: '',
    id_number: '',
    gender: 'Male',
    password: '',
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

  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    
    // Validations
    if (patientForm.id_number.length !== 13) {
      setModalError('National ID must be exactly 13 digits');
      return;
    }
    if (patientForm.phone_number.length !== 10 || patientForm.next_of_kin_phone.length !== 10) {
      setModalError('Phone numbers must be exactly 10 digits');
      return;
    }

    setModalLoading(true);
    try {
      const response = await api.post('/auth/register-patient', patientForm);
      if (response.data && response.data.patient) {
        setModalSuccess('Patient registered successfully!');
        
        // Add new patient to state list
        const newPt = response.data.patient;
        setPatients([
          ...patients,
          {
            id: 'PT-' + newPt.id,
            name: newPt.fullname,
            age: 30, // Default simulated age
            gender: patientForm.gender,
            condition: 'New Registration',
            status: 'Stable',
            chw: 'Unassigned',
            lastCheck: new Date().toISOString().split('T')[0]
          }
        ]);

        // Reset form
        setPatientForm({
          fullname: '',
          id_number: '',
          gender: 'Male',
          password: '',
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

        // Close modal after 1.5s
        setTimeout(() => {
          setIsModalOpen(false);
          setModalSuccess('');
        }, 1500);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to register patient');
    } finally {
      setModalLoading(false);
    }
  };

  const appointmentsList = [
    { id: 'AP-501', patient: 'Jane Smith', type: 'Diabetes Follow-up', doctor: 'Dr. Sarah Jenkins', time: '10:30 AM', date: '2026-06-20', status: 'Upcoming' },
    { id: 'AP-502', patient: 'John Doe', type: 'Cardiology Routine Check', doctor: 'Dr. Sarah Jenkins', time: '02:00 PM', date: '2026-06-20', status: 'Upcoming' },
    { id: 'AP-503', patient: 'David Miller', type: 'Nephrology Consult', doctor: 'Dr. Allan Boesak', time: '09:00 AM', date: '2026-06-21', status: 'Scheduled' },
    { id: 'AP-504', patient: 'Zanele Ndlovu', type: 'Antenatal Check-up', doctor: 'Dr. Winnie Mandela', time: '11:15 AM', date: '2026-06-22', status: 'Scheduled' }
  ];

  const referralsList = [
    { id: 'RF-801', patient: 'Jane Smith', from: 'Community Clinic A', to: 'UbuntuHealth General Hospital', department: 'Endocrinology', date: '2026-06-19', status: 'Pending Review' },
    { id: 'RF-802', patient: 'David Miller', from: 'Health Outpost B', to: 'UbuntuHealth General Hospital', department: 'Nephrology', date: '2026-06-18', status: 'Approved' },
    { id: 'RF-803', patient: 'Zanele Ndlovu', from: 'Midwife Center C', to: 'UbuntuHealth General Hospital', department: 'Obstetrics', date: '2026-06-17', status: 'Approved' }
  ];

  const sidebarItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'patients', name: 'Patients', icon: Users },
    { id: 'chws', name: 'Comm. Health Workers', icon: UserIcon },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'referrals', name: 'Referrals', icon: ArrowLeftRight },
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
              <Users className="h-5 w-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              UbuntuHealth
            </span>
          </div>

          {/* User Details Block */}
          <div className="p-6 border-b border-slate-800/80 bg-slate-950/30">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-slate-800 flex items-center justify-center text-sm font-extrabold border border-slate-700 text-emerald-400 shrink-0">
                {user.name ? user.name.split(' ').map(n=>n[0]).join('').toUpperCase() : 'MD'}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-200 text-sm truncate">{user.name}</h3>
                <p className="text-slate-500 text-xs truncate mb-1">{user.email}</p>
                <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  {user.organization} Admin
                </span>
              </div>
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
                      ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-emerald-400 border border-emerald-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.name}
                  {item.id === 'chat' && (
                    <span className="ml-auto bg-emerald-500 text-slate-950 rounded-full text-[10px] font-extrabold px-1.5 py-0.5 animate-pulse">
                      4
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
        <div className="absolute top-[-15%] right-[-15%] w-[600px] h-[600px] bg-emerald-950/10 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Top Header Bar */}
        <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide capitalize">
              {activeTab === 'chat' ? 'Medical Chat Room' : activeTab}
            </h1>
            <span className="text-xs text-slate-500 font-mono">| Portal Access</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input Bar */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search patient, routine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800/80 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 w-64 transition-all duration-300"
              />
            </div>

            {/* Notification Badge */}
            <button className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-emerald-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Dynamic Inner Dashboard Pages */}
        <section className="flex-grow p-8 overflow-y-auto relative z-10 max-w-7xl w-full mx-auto">
          
          {/* ================= PAGE: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Portal Welcome Notification Banner */}
              <div className="bg-gradient-to-r from-emerald-950/30 to-slate-900/30 border border-emerald-500/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-100">Welcome Back to Clinical Hub</h2>
                  <p className="text-slate-400 text-xs">Verify medical routines, follow ups, and chat rooms in real-time.</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Security Cleared
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { title: 'Total Patients', value: patients.length.toString(), change: 'Registered by you', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  { title: 'Appointments Today', value: '8', change: 'Next at 10:30 AM', icon: Calendar, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
                  { title: 'Pending Referrals', value: '3', change: 'Requires Action', icon: ArrowLeftRight, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                  { title: 'Active Health Workers', value: chws.length.toString(), change: 'Registered in organization', icon: ShieldCheck, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
                ].map((stat, i) => {
                  const StatIcon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <span className="text-slate-500 text-xs font-semibold tracking-wide uppercase">{stat.title}</span>
                        <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                        <p className="text-[11px] text-slate-400">{stat.change}</p>
                      </div>
                      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${stat.color}`}>
                        <StatIcon className="h-5 w-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid: Upcoming Appointments & Referrals overview */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Block: Upcoming Appointments list */}
                <div className="md:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-slate-200">Appointments Schedule</h3>
                      <p className="text-slate-500 text-xs">Today’s appointments at General Hospital</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('appointments')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800/80">
                    {appointmentsList.slice(0, 3).map((app) => (
                      <div key={app.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                            {app.patient.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 text-sm">{app.patient}</p>
                            <p className="text-xs text-slate-400">{app.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-200 font-semibold">{app.time}</p>
                          <span className="inline-block bg-sky-500/10 text-sky-400 rounded-full px-2 py-0.5 text-[9px] font-bold mt-1">
                            {app.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Block: System Referral alerts */}
                <div className="md:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-slate-200">Pending Referrals</h3>
                      <p className="text-slate-500 text-xs">Incoming cases requiring authorization</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('referrals')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {referralsList.slice(0, 2).map((ref) => (
                      <div key={ref.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl flex flex-col justify-between gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200 text-xs">{ref.patient}</span>
                          <span className="text-[10px] font-mono text-slate-500">{ref.id}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                          <span>{ref.department}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            ref.status === 'Pending Review' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {ref.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ================= PAGE: PATIENTS ================= */}
          {activeTab === 'patients' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Follow-up Patients</h3>
                  <p className="text-slate-500 text-xs">List of patients assigned to your local medical facility</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add Patient
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Condition</th>
                      <th className="py-3 px-4">Assigned CHW</th>
                      <th className="py-3 px-4">Last Check-up</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingPatients ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-550">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading patients list...
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-550">
                          No patients associated with you found. Click "Add Patient" to register one.
                        </td>
                      </tr>
                    ) : (
                      patients.map((pt) => (
                        <tr key={pt.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {pt.name}
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">{pt.id}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">{pt.gender}, {pt.age}</td>
                          <td className="py-3.5 px-4 text-slate-300">{pt.condition}</td>
                          <td className="py-3.5 px-4 text-slate-400">{pt.chw}</td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">{pt.lastCheck}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              pt.status === 'Stable' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {pt.status}
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

          {/* ================= PAGE: COMMUNITY HEALTH WORKERS ================= */}
          {activeTab === 'chws' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Community Health Workers</h3>
                  <p className="text-slate-500 text-xs">List of registered community health workers in your organization</p>
                </div>
                <button 
                  onClick={() => setIsChwModalOpen(true)}
                  className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add CHW
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Name & Employee ID</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">National ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingChws ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-550">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading community health workers...
                        </td>
                      </tr>
                    ) : chws.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-550">
                          No community health workers found. Click "Add CHW" to register one.
                        </td>
                      </tr>
                    ) : (
                      chws.map((chw) => (
                        <tr key={chw.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {chw.fullname}
                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Emp ID: {chw.employee_id}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {chw.gender}, {calculateAgeFromId(chw.id_number)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-350">
                            <span className="block text-slate-200">{chw.phone_number}</span>
                            <span className="block text-xs text-slate-500">{chw.email || 'No email provided'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {chw.surbub}, {chw.city}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{chw.id_number}</td>
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
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Appointments List</h3>
                  <p className="text-slate-500 text-xs">Calendar schedule of appointments</p>
                </div>
                <button className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors">
                  <Plus className="h-4 w-4" /> Schedule Visit
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Consultation Type</th>
                      <th className="py-3 px-4">Clinician / Doctor</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {appointmentsList.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-200">{app.patient}</td>
                        <td className="py-3.5 px-4 text-slate-300">{app.type}</td>
                        <td className="py-3.5 px-4 text-slate-400">{app.doctor}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                          {app.date} <span className="text-slate-500">at {app.time}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            app.status === 'Upcoming' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= PAGE: REFERRALS ================= */}
          {activeTab === 'referrals' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Patient Referrals</h3>
                  <p className="text-slate-500 text-xs">Medical transfers across health networks</p>
                </div>
                <button className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors">
                  <Plus className="h-4 w-4" /> Create Referral
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Referral ID</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Referral Source & Target</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {referralsList.map((ref) => (
                      <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{ref.id}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-200">{ref.patient}</td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="text-slate-400">{ref.from}</span>
                          <ChevronRight className="inline-block h-3.5 w-3.5 text-slate-500 mx-1" />
                          <span className="text-emerald-400">{ref.to}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{ref.department}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{ref.date}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            ref.status === 'Pending Review' ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {ref.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= PAGE: CHAT ROOM ================= */}
          {activeTab === 'chat' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl h-[calc(100vh-14rem)] flex flex-col justify-between overflow-hidden">
              
              {/* Message Header info */}
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-xs text-slate-300 font-semibold">Active staff discussion channel</span>
                </div>
                <span className="text-slate-500 text-xs font-mono">Channel: #general-staff</span>
              </div>

              {/* Message History */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-950/10">
                {chatMessages.map((msg) => {
                  const isSelf = msg.sender === 'You';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[70%] space-y-1 ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-slate-300">{msg.sender}</span>
                        <span className="text-[10px] text-slate-500">{msg.role}</span>
                      </div>
                      <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                        isSelf 
                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-none' 
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono">{msg.time}</span>
                    </div>
                  );
                })}
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
                <input
                  type="text"
                  placeholder="Type a clinical update or query..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all duration-300"
                />
                <button
                  type="submit"
                  className="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 hover:brightness-110 active:scale-95 transition-all duration-300"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>

            </div>
          )}

        </section>
      </main>

      {/* ================= PATIENT REGISTRATION MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsModalOpen(false); setModalError(''); setModalSuccess(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Register New Patient</h2>
              <p className="text-slate-400 text-xs mt-1">Provide all details to add the patient to the clinical register.</p>
            </div>

            {/* Error & Success Notification */}
            {modalError && (
              <div className="bg-red-950/40 border border-red-500/25 text-red-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{modalError}</span>
              </div>
            )}
            {modalSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className="space-y-6">
              
              {/* Group 1: General Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Firstname Lastname"
                      value={patientForm.fullname}
                      onChange={(e) => setPatientForm({...patientForm, fullname: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold">Gender *</label>
                      <select
                        value={patientForm.gender}
                        onChange={(e) => setPatientForm({...patientForm, gender: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold">National ID *</label>
                      <input
                        type="text"
                        required
                        maxLength={13}
                        placeholder="13-digit ID"
                        value={patientForm.id_number}
                        onChange={(e) => setPatientForm({...patientForm, id_number: e.target.value.replace(/\D/g, '')})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit phone"
                      value={patientForm.phone_number}
                      onChange={(e) => setPatientForm({...patientForm, phone_number: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                    <input
                      type="email"
                      placeholder="patient@hospital.com"
                      value={patientForm.email}
                      onChange={(e) => setPatientForm({...patientForm, email: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Portal Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Choose password"
                      value={patientForm.password}
                      onChange={(e) => setPatientForm({...patientForm, password: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Address Info */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Address Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">House Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14B"
                      value={patientForm.house_number}
                      onChange={(e) => setPatientForm({...patientForm, house_number: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Suburb *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Melville"
                      value={patientForm.surbub}
                      onChange={(e) => setPatientForm({...patientForm, surbub: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Municipality *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City of Joburg"
                      value={patientForm.municipality}
                      onChange={(e) => setPatientForm({...patientForm, municipality: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Johannesburg"
                      value={patientForm.city}
                      onChange={(e) => setPatientForm({...patientForm, city: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Group 3: Next of Kin */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Next of Kin Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Kin Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Kin Name"
                      value={patientForm.next_of_kin_fullname}
                      onChange={(e) => setPatientForm({...patientForm, next_of_kin_fullname: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Kin Phone Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="Kin Phone"
                      value={patientForm.next_of_kin_phone}
                      onChange={(e) => setPatientForm({...patientForm, next_of_kin_phone: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Kin Email</label>
                    <input
                      type="email"
                      placeholder="kin@email.com"
                      value={patientForm.next_of_kin_email}
                      onChange={(e) => setPatientForm({...patientForm, next_of_kin_email: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setModalError(''); setModalSuccess(''); }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {modalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {modalLoading ? 'Registering Patient...' : 'Register Patient'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= CHW REGISTRATION MODAL ================= */}
      {isChwModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsChwModalOpen(false); setChwModalError(''); setChwModalSuccess(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Register New Community Health Worker</h2>
              <p className="text-slate-400 text-xs mt-1">Provide all details to add the worker to the organization.</p>
            </div>

            {/* Error & Success Notification */}
            {chwModalError && (
              <div className="bg-red-950/40 border border-red-500/25 text-red-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{chwModalError}</span>
              </div>
            )}
            {chwModalSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{chwModalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterChw} className="space-y-6">
              
              {/* Group 1: General Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Firstname Lastname"
                      value={chwForm.fullname}
                      onChange={(e) => setChwForm({...chwForm, fullname: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold">Gender *</label>
                      <select
                        value={chwForm.gender}
                        onChange={(e) => setChwForm({...chwForm, gender: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold">National ID *</label>
                      <input
                        type="text"
                        required
                        maxLength={13}
                        placeholder="13-digit ID"
                        value={chwForm.id_number}
                        onChange={(e) => setChwForm({...chwForm, id_number: e.target.value.replace(/\D/g, '')})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Employee ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CHW-102"
                      value={chwForm.employee_id}
                      onChange={(e) => setChwForm({...chwForm, employee_id: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit phone"
                      value={chwForm.phone_number}
                      onChange={(e) => setChwForm({...chwForm, phone_number: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                    <input
                      type="email"
                      placeholder="chw@hospital.com"
                      value={chwForm.email}
                      onChange={(e) => setChwForm({...chwForm, email: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Portal Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Choose password"
                      value={chwForm.password}
                      onChange={(e) => setChwForm({...chwForm, password: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Address Info */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Address Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">House Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14B"
                      value={chwForm.house_number}
                      onChange={(e) => setChwForm({...chwForm, house_number: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Suburb *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Melville"
                      value={chwForm.surbub}
                      onChange={(e) => setChwForm({...chwForm, surbub: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Municipality *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City of Joburg"
                      value={chwForm.municipality}
                      onChange={(e) => setChwForm({...chwForm, municipality: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Johannesburg"
                      value={chwForm.city}
                      onChange={(e) => setChwForm({...chwForm, city: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsChwModalOpen(false); setChwModalError(''); setChwModalSuccess(''); }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={chwModalLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {chwModalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {chwModalLoading ? 'Registering CHW...' : 'Register CHW'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

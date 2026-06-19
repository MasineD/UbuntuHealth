import { useState } from 'react';
import { LayoutDashboard, Users, Calendar, ArrowLeftRight, MessageSquare, LogOut, Loader2,ShieldCheck,Search,Bell,Plus,Send,User as UserIcon,CheckCircle,FileText,Clock,Menu,ChevronRight
} from 'lucide-react';

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

  // Simulated data lists
  const patientsList = [
    { id: 'PT-1082', name: 'John Doe', age: 45, gender: 'Male', condition: 'Hypertension', status: 'Stable', chw: 'Musa Dube', lastCheck: '2026-06-18' },
    { id: 'PT-1094', name: 'Jane Smith', age: 32, gender: 'Female', condition: 'Diabetes Type 2', status: 'Requires Review', chw: 'Lindiwe Sisulu', lastCheck: '2026-06-19' },
    { id: 'PT-1102', name: 'David Miller', age: 67, gender: 'Male', condition: 'Chronic Kidney Disease', status: 'Stable', chw: 'Musa Dube', lastCheck: '2026-06-15' },
    { id: 'PT-1115', name: 'Zanele Ndlovu', age: 29, gender: 'Female', condition: 'Pregnancy Follow-up', status: 'Stable', chw: 'Naledi Pandor', lastCheck: '2026-06-17' }
  ];

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
                  { title: 'Total Patients', value: '1,482', change: '+12% this week', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  { title: 'Appointments Today', value: '8', change: 'Next at 10:30 AM', icon: Calendar, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
                  { title: 'Pending Referrals', value: '3', change: 'Requires Action', icon: ArrowLeftRight, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                  { title: 'Active Health Workers', value: '45', change: '8 online', icon: ShieldCheck, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
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
                <button className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors">
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
                    {patientsList.map((pt) => (
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
                    ))}
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

    </div>
  );
}

export default Dashboard;

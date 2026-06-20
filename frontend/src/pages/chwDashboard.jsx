import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, Clock, LogOut, Loader2, ShieldCheck, Bell, CheckCircle, User as UserIcon, Heart, Calendar, Activity, ClipboardList, MapPin } from 'lucide-react';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function ChwDashboard({ user, onLogout, actionLoading }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'patients' | 'visits'
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

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
  }, []);

  const sidebarItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'patients', name: 'Assigned Patients', icon: Users },
    { id: 'visits', name: 'Daily Visits', icon: ClipboardList }
  ];

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
            
            <button className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-teal-500 rounded-full" />
            </button>
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

        </section>
      </main>
    </div>
  );
}

export default ChwDashboard;

import { useState } from 'react';
import { LayoutDashboard, FileText, Clock, Phone, LogOut, Loader2,ShieldCheck,Bell,CheckCircle,User as UserIcon,Activity,Heart,ChevronRight, Calendar
} from 'lucide-react';

function PatientDashboard({ user, onLogout, actionLoading }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'records' | 'routines' | 'contacts'
  
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
    { id: 'records', name: 'Medical Records', icon: FileText },
    { id: 'routines', name: 'Daily Routines', icon: Clock },
    { id: 'contacts', name: 'Contacts', icon: Phone }
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
              {activeTab === 'records' ? 'Medical Records History' : activeTab === 'routines' ? 'Daily Medication & Routines' : activeTab}
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
            <button className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-teal-500 rounded-full" />
            </button>
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
                <div className="md:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <h3 className="font-bold text-slate-200">Today’s Health Checklist</h3>
                    <button 
                      onClick={() => setActiveTab('routines')}
                      className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      Manage Routines
                    </button>
                  </div>

                  <div className="space-y-3">
                    {routines.slice(0, 3).map((r) => (
                      <div key={r.id} className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-slate-500 block">{r.time}</span>
                          <span className="text-xs font-medium text-slate-300">{r.task}</span>
                        </div>
                        <button
                          onClick={() => toggleRoutineStatus(r.id)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                            r.status === 'Completed' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {r.status}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Last medical reports summary */}
                <div className="md:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
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
                </div>

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
                {routines.map((r) => (
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
                ))}
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

        </section>
      </main>

    </div>
  );
}

export default PatientDashboard;

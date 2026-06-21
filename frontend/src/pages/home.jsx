import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  User, Lock, Mail, Phone, Building2, ShieldCheck, Activity, Loader2, 
  CheckCircle, AlertCircle, Calendar, Clock, Stethoscope, ArrowRight, 
  Sparkles, Eye, EyeOff, LayoutDashboard, HeartPulse, LogOut
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function Home({ 
  user, 
  authMode, 
  setAuthMode, 
  onLoginSubmit, 
  onRegisterSubmit, 
  onLogout, 
  actionLoading, 
  error, 
  success,
  loginInput,
  setLoginInput,
  registerInput,
  setRegisterInput
}) {
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    fullname: '',
    phone_number: '',
    organization_to: '',
    department_to: 'General Medicine',
    staff_to: '',
    reason: '',
    arrival_date: '',
    arrival_time: ''
  });

  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Organization/Staff Dynamic Lists
  const [organizations, setOrganizations] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Search queries for searchable selectors
  const [orgQuery, setOrgQuery] = useState('');
  const [deptQuery, setDeptQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');

  // Fetch registered organizations
  useEffect(() => {
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
    fetchOrganizations();
  }, []);

  // Pre-fill fullname and phone if logged-in user is a patient
  useEffect(() => {
    if (user && user.role === 'patient') {
      setBookingForm(prev => ({
        ...prev,
        fullname: user.name || user.fullname || '',
        phone_number: user.phone_number || ''
      }));
    } else {
      setBookingForm(prev => ({
        ...prev,
        fullname: '',
        phone_number: ''
      }));
    }
  }, [user]);

  // Handle organization selection change
  const handleOrgChange = async (orgName) => {
    setBookingForm(prev => ({ ...prev, organization_to: orgName, staff_to: '' }));
    setStaffList([]);
    setStaffQuery('');
    
    if (!orgName) return;

    try {
      const res = await api.get(`${API_URL}/auth/organizations/${encodeURIComponent(orgName)}/staff`);
      if (res.data && res.data.staff) {
        setStaffList(res.data.staff);
      }
    } catch (err) {
      console.error('Error fetching staff members:', err);
    }
  };

  // Submit Booking Form
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');

    // Client-side phone number validation
    if (bookingForm.phone_number && !/^[0-9]{10}$/.test(bookingForm.phone_number)) {
      setBookingError('Phone number must be exactly 10 digits (e.g. 0821234567)');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await api.post(`${API_URL}/auth/appointments`, bookingForm);
      const keyMsg = res.data.appointment?.appointment_key ? ` Verification Key: ${res.data.appointment.appointment_key}` : '';
      setBookingSuccess((res.data.message || 'Appointment requested successfully!') + keyMsg);
      
      // Reset form (keep patient details if logged in)
      setBookingForm({
        fullname: user && user.role === 'patient' ? (user.name || user.fullname || '') : '',
        phone_number: user && user.role === 'patient' ? (user.phone_number || '') : '',
        organization_to: '',
        department_to: 'General Medicine',
        staff_to: '',
        reason: '',
        arrival_date: '',
        arrival_time: ''
      });
      setOrgQuery('');
      setDeptQuery('');
      setStaffQuery('');
      setStaffList([]);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Failed to request appointment. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Filtered dropdown lists based on search queries
  const filteredOrgs = organizations.filter(org => 
    org.toLowerCase().includes(orgQuery.toLowerCase())
  );

  const departments = [
    'General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Dermatology', 
    'Neurology', 'Endocrinology', 'Nephrology', 'Obstetrics & Gynecology', 
    'Psychiatry', 'Physical Therapy'
  ];
  const filteredDepts = departments.filter(dept => 
    dept.toLowerCase().includes(deptQuery.toLowerCase())
  );

  const filteredStaff = staffList.filter(s => 
    s.fullname.toLowerCase().includes(staffQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 pb-16 px-4">
      
      {/* BRAND HEADER */}
      <div className="flex items-center gap-3 pt-6">
        <div className="bg-emerald-500 h-10 w-10 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
          <HeartPulse className="h-5.5 w-5.5 text-slate-950 fill-slate-950 stroke-[2.5]" />
        </div>
        <span className="text-2xl font-black tracking-tight text-white font-sans select-none">
          Ubuntu<span className="text-emerald-500">Health</span>
        </span>
      </div>

      {/* HERO & BRANDING & LOGIN SECTION */}
      <div className="w-full min-h-[75vh] flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8 py-8">
        
        {/* LEFT COLUMN: Hero content */}
        <div className="lg:w-1/2 flex flex-col justify-center space-y-8 text-left animate-fadeIn">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight font-sans tracking-tight">
            Healthcare for Everyone, <br />
            <span className="text-emerald-500">Everywhere</span>
          </h1>
          
          <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-lg">
            Providing accessible, digital healthcare across communities. Check records, consult online, and log clinic referrals securely.
          </p>

          <hr className="border-slate-900 w-full" />

          <div className="space-y-4">
            <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">
              TRUSTED BY:
            </span>
            <div className="flex flex-wrap gap-3">
              {[
                { name: 'Helen Joseph' },
                { name: 'MediClinic' },
                { name: 'Unjani Clinic' },
                { name: 'health' },
                { name: 'tshwane' }
              ].map((clinic, index) => (
                <div 
                  key={index}
                  className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-350 shadow-md transition-all hover:border-slate-700"
                >
                  <Building2 className="text-emerald-500 h-4 w-4" />
                  <span>{clinic.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Card */}
        <div className="w-full lg:w-[460px] shrink-0">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative transition-all duration-300 hover:border-slate-700/80">
            
            {user ? (
              /* Logged In View */
              <div className="space-y-6">
                <div className="border-b border-slate-900 pb-5 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mx-auto mb-3">
                    <User className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Active Session</h2>
                  <p className="text-slate-500 text-xs mt-1">Manage your credentialed access</p>
                </div>

                <div className="p-5 bg-slate-950 border border-slate-900 rounded-2xl flex flex-col gap-4">
                  <div className="space-y-1 text-center">
                    <h3 className="text-sm font-bold text-slate-200">{user.name || user.fullname}</h3>
                    <p className="text-xs text-slate-500">{user.email || 'No email registered'}</p>
                    <span className="inline-block bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-2">
                      {user.role} Account
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={() => setAuthMode('dashboard')}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                    </button>
                    <button
                      onClick={onLogout}
                      disabled={actionLoading}
                      className="w-full py-3 bg-slate-950 border border-slate-900 hover:border-red-500/20 hover:text-red-400 text-slate-400 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign Out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Forms: Login / Register */
              <div className="space-y-6">
                
                {/* Error and Success alerts */}
                {error && (
                  <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/20 rounded-xl text-red-300 text-xs">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs">
                    <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{success}</span>
                  </div>
                )}

                {authMode === 'login' && (
                  <form onSubmit={onLoginSubmit} className="space-y-5">
                    <h2 className="text-xl font-bold text-white text-center tracking-tight font-sans">Sign In</h2>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">ID NUMBER</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                        <input
                          type="text"
                          required
                          placeholder="Enter identity number"
                          value={loginInput.identity}
                          onChange={(e) => setLoginInput({ ...loginInput, identity: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 font-bold tracking-wider uppercase block">PASSWORD</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter password"
                          value={loginInput.password}
                          onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-3 pl-12 pr-12 text-sm text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <a className="text-[10px] text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer select-none">
                        Forgot password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 hover:brightness-110 active:scale-[0.98] text-slate-950 font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-950/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
                      {actionLoading ? 'Verifying...' : 'Sign In'}
                    </button>

                    <p className="text-[11px] text-slate-500 text-center mt-4">
                      Don't have an account?{' '}
                      <span 
                        onClick={() => setAuthMode('register')} 
                        className="text-emerald-500 font-bold hover:underline cursor-pointer"
                      >
                        Sign Up
                      </span>
                    </p>
                  </form>
                )}

                {authMode === 'register' && (
                  <form onSubmit={onRegisterSubmit} className="space-y-4">
                    <h2 className="text-xl font-bold text-white text-center tracking-tight font-sans">Register Admin</h2>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe"
                          value={registerInput.fullname}
                          onChange={(e) => setRegisterInput({ ...registerInput, fullname: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Identity / Username</label>
                        <input
                          type="text"
                          required
                          placeholder="Admin ID"
                          value={registerInput.identity}
                          onChange={(e) => setRegisterInput({ ...registerInput, identity: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Phone Number</label>
                        <input
                          type="tel"
                          required
                          placeholder="10-digit number"
                          value={registerInput.phone_number}
                          onChange={(e) => setRegisterInput({ ...registerInput, phone_number: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="admin@clinic.com"
                          value={registerInput.email}
                          onChange={(e) => setRegisterInput({ ...registerInput, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Organization</label>
                        <input
                          type="text"
                          required
                          placeholder="Clinic name"
                          value={registerInput.organization}
                          onChange={(e) => setRegisterInput({ ...registerInput, organization: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Facility Code</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. FAC-99"
                          value={registerInput.facility_code}
                          onChange={(e) => setRegisterInput({ ...registerInput, facility_code: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold tracking-wider uppercase block">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Choose password"
                        value={registerInput.password}
                        onChange={(e) => setRegisterInput({ ...registerInput, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-900 focus:border-emerald-500/50 rounded-xl py-2 px-3.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 hover:brightness-110 active:scale-[0.98] text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-950/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
                      {actionLoading ? 'Creating Account...' : 'Register'}
                    </button>

                    <p className="text-[11px] text-slate-500 text-center mt-3">
                      Already have an account?{' '}
                      <span 
                        onClick={() => setAuthMode('login')} 
                        className="text-emerald-500 font-bold hover:underline cursor-pointer"
                      >
                        Sign In
                      </span>
                    </p>
                  </form>
                )}

              </div>
            )}

          </div>
        </div>
        
      </div>

      {/* ================= SECTION 2: APPOINTMENT BOOKING ================= */}
      <section className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-10 space-y-6 shadow-2xl relative transition-all duration-300 hover:border-slate-700/80">
        <div className="absolute top-0 right-0 h-48 w-48 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Book an Appointment</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {user ? 'Welcome back! Your logged-in details are pre-filled below.' : 'No account? No problem. Fill in your details below to request a slot.'}
              </p>
            </div>
          </div>
        </div>

        {bookingError && (
          <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{bookingError}</span>
          </div>
        )}

        {bookingSuccess && (
          <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{bookingSuccess}</span>
          </div>
        )}

        <form onSubmit={handleBookingSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Patient Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Patient Full Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Enter patient full name"
                  disabled={user && user.role === 'patient'}
                  value={bookingForm.fullname}
                  onChange={e => setBookingForm({ ...bookingForm, fullname: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all disabled:opacity-50 disabled:bg-slate-950/40"
                />
              </div>
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Contact Number (10 digits) *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 0821234567"
                  value={bookingForm.phone_number}
                  onChange={e => setBookingForm({ ...bookingForm, phone_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-660 outline-none transition-all"
                />
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Destination Organization */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Organization *</label>
              </div>
              <select
                required
                value={bookingForm.organization_to}
                onChange={e => handleOrgChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all"
              >
                <option value="">-- Select Medical Facility --</option>
                {filteredOrgs.map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </div>

            {/* Target Department */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Department *</label>
              </div>
              <select
                required
                value={bookingForm.department_to}
                onChange={e => setBookingForm({ ...bookingForm, department_to: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all"
              >
                {filteredDepts.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Clinician / Staff member */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Target Clinician (Optional - defaults to Admin)</label>
            </div>
            <select
              value={bookingForm.staff_to}
              onChange={e => setBookingForm({ ...bookingForm, staff_to: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none transition-all disabled:opacity-50"
              disabled={!bookingForm.organization_to}
            >
              <option value="">-- Choose Staff Member (Defaults to Facility Admin) --</option>
              {filteredStaff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullname} ({s.staff_role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Arrival Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Estimated Appointment Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="date"
                  required
                  value={bookingForm.arrival_date}
                  onChange={e => setBookingForm({ ...bookingForm, arrival_date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition-all"
                />
              </div>
            </div>

            {/* Arrival Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Preferred Time (Optional)</label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="time"
                  value={bookingForm.arrival_time}
                  onChange={e => setBookingForm({ ...bookingForm, arrival_time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition-all"
                />
              </div>
            </div>

          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Reason for Booking *</label>
            <textarea
              required
              rows={3}
              placeholder="State symptoms, consultation needs, or medication refill details..."
              value={bookingForm.reason}
              onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-650 outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={bookingLoading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 hover:brightness-110 active:scale-[0.98] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            Request Appointment Slot
          </button>
        </form>
      </section>
    </div>
  );
}

export default Home;

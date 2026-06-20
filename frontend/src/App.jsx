import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Lock, Mail, Phone, Building2, ShieldCheck, Activity, LogOut, Eye, EyeOff, CheckCircle,AlertCircle,Loader2
} from 'lucide-react';
import Dashboard from './pages/dashboard';
import PatientDashboard from './pages/patientDashboard';
import ChwDashboard from './pages/chwDashboard';

// Configure axios with baseURL and credentials to support HTTP-only cookies
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

function App() {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'dashboard'
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Form Inputs
  const [loginInput, setLoginInput] = useState({
    identity: '',
    password: ''
  });

  const [registerInput, setRegisterInput] = useState({
    fullname: '',
    identity: '',
    phone_number: '',
    email: '',
    organization: '',
    facility_code: '',
    password: ''
  });

  // Check current session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get('/auth/current');
        if (response.data && response.data.user) {
          setUser(response.data.user);
          setAuthMode('dashboard');
        }
      } catch (err) {
        // Not authorized/logged in, keep login/register screen
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!loginInput.identity || !loginInput.password) {
      setError('Please fill in all fields');
      return;
    }

    setActionLoading(true);
    try {
      const response = await api.post('/auth/login', loginInput);
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setSuccess('Logged in successfully!');
        // Transition to dashboard after a brief delay for user feedback
        setTimeout(() => {
          setAuthMode('dashboard');
          setSuccess('');
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid identity or password');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Check all fields
    const { fullname, identity, phone_number, email, organization, facility_code, password } = registerInput;
    if (!fullname || !identity || !phone_number || !email || !organization || !facility_code || !password) {
      setError('All fields are required');
      return;
    }

    setActionLoading(true);
    try {
      const response = await api.post('/auth/register', registerInput);
      if (response.data && response.data.user) {
        setUser(response.data.user);
        setSuccess('Account created successfully!');
        setTimeout(() => {
          setAuthMode('dashboard');
          setSuccess('');
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await api.post('/auth/logout');
      setUser(null);
      setAuthMode('login');
      // Clear inputs
      setLoginInput({ identity: '', password: '' });
      setRegisterInput({
        fullname: '',
        identity: '',
        phone_number: '',
        email: '',
        organization: '',
        facility_code: '',
        password: ''
      });
    } catch (err) {
      setError('Failed to log out');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans">
        <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 animate-pulse font-medium">Initializing UbuntuHealth UI...</p>
      </div>
    );
  }

  if (authMode === 'dashboard' && user) {
    if (user.role === 'patient') {
      return (
        <PatientDashboard 
          user={user} 
          onLogout={handleLogout} 
          actionLoading={actionLoading} 
        />
      );
    }
    if (user.role === 'chw') {
      return (
        <ChwDashboard 
          user={user} 
          onLogout={handleLogout} 
          actionLoading={actionLoading} 
        />
      );
    }
    return (
      <Dashboard 
        user={user} 
        onLogout={handleLogout} 
        actionLoading={actionLoading} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-emerald-500 selection:text-slate-950 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-950/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main UI Card Wrapper */}
      <div className="w-full max-w-5xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px] relative z-10 transition-all duration-500">
        
        {/* Left Side: Branding Panel */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-teal-950 to-emerald-950 p-8 flex flex-col justify-between relative overflow-hidden border-r border-slate-800/60">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Activity className="h-5 w-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              UbuntuHealth
            </span>
          </div>

          <div className="my-auto py-12 relative z-10">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-4 leading-tight">
              Patient Care, <br />
              <span className="text-emerald-400">Simplified & Secured.</span>
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
              An intelligent clinical portal assisting health professionals with streamlined patient routines, routine follow-ups, and collaborative care.
            </p>
          </div>

          <div className="text-xs text-slate-400/80 flex items-center gap-2 relative z-10">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            POPI Act Compliant & Secure Data Transfer
          </div>
        </div>

        {/* Right Side: Auth Forms */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-slate-900/30">
          
          {authMode !== 'dashboard' && (
            <div className="w-full max-w-md mx-auto">
              
              {/* Header Toggle tabs */}
              <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 mb-8">
                <button
                  onClick={() => { setAuthMode('login'); setError(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-300 ${
                    authMode === 'login' 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setError(''); }}
                  className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-300 ${
                    authMode === 'register' 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Status Notifications */}
              {error && (
                <div className="flex items-center gap-3 p-4 mb-6 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-sm animate-shake">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-3 p-4 mb-6 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm animate-pulse">
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  <span>{success}</span>
                </div>
              )}

              {/* ===== SIGN IN FORM ===== */}
              {authMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Identity / National ID</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Enter your administrative identity"
                        value={loginInput.identity}
                        onChange={(e) => setLoginInput({ ...loginInput, identity: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your secure password"
                        value={loginInput.password}
                        onChange={(e) => setLoginInput({ ...loginInput, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-3 pl-11 pr-11 text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl transition-all duration-300 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                    {actionLoading ? 'Verifying Account...' : 'Sign In to Portal'}
                  </button>
                </form>
              )}

              {/* ===== REGISTER FORM ===== */}
              {authMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Firstname Lastname"
                        value={registerInput.fullname}
                        onChange={(e) => setRegisterInput({ ...registerInput, fullname: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Identity / ID</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Unique identity"
                          value={registerInput.identity}
                          onChange={(e) => setRegisterInput({ ...registerInput, identity: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                        <input
                          type="tel"
                          placeholder="e.g. +27..."
                          value={registerInput.phone_number}
                          onChange={(e) => setRegisterInput({ ...registerInput, phone_number: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        placeholder="you@hospital.com"
                        value={registerInput.email}
                        onChange={(e) => setRegisterInput({ ...registerInput, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Organization</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Hospital/Clinic name"
                          value={registerInput.organization}
                          onChange={(e) => setRegisterInput({ ...registerInput, organization: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Facility Code</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          placeholder="e.g. FC-892"
                          value={registerInput.facility_code}
                          onChange={(e) => setRegisterInput({ ...registerInput, facility_code: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Choose a strong password"
                        value={registerInput.password}
                        onChange={(e) => setRegisterInput({ ...registerInput, password: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/80 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full mt-3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl transition-all duration-300 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {actionLoading ? 'Registering Account...' : 'Complete Registration'}
                  </button>
                </form>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;

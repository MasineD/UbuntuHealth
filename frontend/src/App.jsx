import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Lock, Mail, Phone, Building2, ShieldCheck, Activity, LogOut, Eye, EyeOff, CheckCircle,AlertCircle,Loader2
} from 'lucide-react';
import Dashboard from './pages/dashboard';
import PatientDashboard from './pages/patientDashboard';
import ChwDashboard from './pages/chwDashboard';
import StaffDashboard from './pages/staffDashboard';
import Home from './pages/home';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Configure axios with baseURL and credentials to support HTTP-only cookies
const api = axios.create({
  baseURL: `${API_URL}/api`,
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
        const response = await api.get(`${API_URL}/auth/current`);
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
      const response = await api.post(`${API_URL}/auth/login`, loginInput);
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
      const response = await api.post(`${API_URL}/auth/register`, registerInput);
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
      await api.post(`${API_URL}/auth/logout`);
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

  const handleUserUpdate = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  if (authMode === 'dashboard' && user) {
    if (user.role === 'patient') {
      return (
        <PatientDashboard 
          user={user} 
          onLogout={handleLogout} 
          actionLoading={actionLoading} 
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    if (user.role === 'chw') {
      return (
        <ChwDashboard 
          user={user} 
          onLogout={handleLogout} 
          actionLoading={actionLoading} 
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    if (user.role === 'staff') {
      return (
        <StaffDashboard 
          user={user} 
          onLogout={handleLogout} 
          actionLoading={actionLoading} 
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    return (
      <Dashboard 
        user={user} 
        onLogout={handleLogout} 
        actionLoading={actionLoading} 
        onUserUpdate={handleUserUpdate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500 selection:text-slate-950 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-950/20 rounded-full blur-[120px] pointer-events-none" />

      <Home
        user={user}
        authMode={authMode}
        setAuthMode={setAuthMode}
        onLoginSubmit={handleLoginSubmit}
        onRegisterSubmit={handleRegisterSubmit}
        onLogout={handleLogout}
        actionLoading={actionLoading}
        error={error}
        success={success}
        loginInput={loginInput}
        setLoginInput={setLoginInput}
        registerInput={registerInput}
        setRegisterInput={setRegisterInput}
      />
    </div>
  );
}

export default App;

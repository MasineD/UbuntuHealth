import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, Users, Clock, LogOut, Loader2, ShieldCheck, Bell, 
  CheckCircle, User as UserIcon, Heart, Calendar, Activity, 
  ClipboardList, MapPin, Search, Plus, Save, Trash2, X, ArrowLeftRight, MessageSquare, Send, AlertTriangle
} from 'lucide-react';
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

function StaffDashboard({ user, onLogout, actionLoading, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'appointments' | 'vitals' | 'referrals'
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [vitalsSearchQuery, setVitalsSearchQuery] = useState('');

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
    city: ''
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
          city: res.data.profile.city || ''
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
            staffRole: user.staff_role
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

  // Appointments State
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const response = await api.get('/auth/appointments');
      if (response.data && response.data.appointments) {
        setAppointments(response.data.appointments);
      }
    } catch (err) {
      console.error('Error fetching staff appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleUpdateAppointmentStatus = async (appId, status) => {
    try {
      let key = undefined;
      if (status === 'attended') {
        key = prompt('Please enter the Appointment Verification Key:');
        if (key === null) return; // cancelled
      }
      await api.put('/auth/appointments/${appId}/status', { status, key });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update appointment status');
    }
  };

  // Referrals State
  const [referrals, setReferrals] = useState({ incoming: [], outgoing: [] });
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralModalLoading, setReferralModalLoading] = useState(false);
  const [referralModalError, setReferralModalError] = useState('');
  const [referralModalSuccess, setReferralModalSuccess] = useState('');
  const [organizationsList, setOrganizationsList] = useState([]);
  const [orgStaffList, setOrgStaffList] = useState([]);
  const [orgPatientsList, setOrgPatientsList] = useState([]);

  // Search queries for referral modal selectors
  const [patientQuery, setPatientQuery] = useState('');
  const [orgQuery, setOrgQuery] = useState('');
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

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/auth/organizations');
      if (response.data && response.data.organizations) {
        setOrganizationsList(response.data.organizations);
      }
    } catch (err) {
      console.error('Error fetching organizations list:', err);
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

  const handleOrgChange = async (orgName) => {
    setReferralForm(prev => ({ ...prev, organization_to: orgName, staff_to: '' }));
    setOrgStaffList([]);
    if (!orgName) return;
    try {
      const response = await api.get(`/auth/organizations/${encodeURIComponent(orgName)}/staff`);
      if (response.data && response.data.staff) {
        setOrgStaffList(response.data.staff);
      }
    } catch (err) {
      console.error('Error fetching organization staff:', err);
    }
  };

  const handleCreateReferral = async (e) => {
    e.preventDefault();
    setReferralModalError('');
    setReferralModalSuccess('');
    setReferralModalLoading(true);

    try {
      await api.post('/auth/referrals', referralForm);
      setReferralModalSuccess('Referral created successfully!');
      fetchReferrals();
      setReferralForm({
        personel: '',
        organization_to: '',
        department_to: 'General Medicine',
        staff_to: '',
        reason: '',
        arrival_date: '',
        arrival_time: ''
      });
      setPatientQuery('');
      setOrgQuery('');
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
    setOrgQuery('');
    setDeptQuery('');
    setStaffQuery('');
  };

  const handleUpdateReferralStatus = async (refId) => {
    try {
      const key = prompt('Please enter the Referral Verification Key:');
      if (key === null) return; // cancelled
      await api.put(`/auth/referrals/${refId}/status`, { key });
      fetchReferrals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update referral status');
    }
  };

  // Selected Patient & Health Record Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isHealthRecordModalOpen, setIsHealthRecordModalOpen] = useState(false);
  const [healthRecord, setHealthRecord] = useState({
    blood_type: '',
    blood_pressure: '',
    weight: '',
    height: '',
    sugar_level: '',
    diagnosis: '',
    on_treatment: false,
    morning_time: '',
    midday_time: '',
    evening_time: '',
    admission_date: '',
    release_date: ''
  });
  const [routines, setRoutines] = useState([]);
  const [isEditingHealthRecord, setIsEditingHealthRecord] = useState(false);
  const [verifyIdNumber, setVerifyIdNumber] = useState('');
  const [dbOnTreatment, setDbOnTreatment] = useState(false);
  const [savingHealthRecord, setSavingHealthRecord] = useState(false);
  const [healthRecordError, setHealthRecordError] = useState('');
  const [healthRecordSuccess, setHealthRecordSuccess] = useState('');



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

  const findPatientByName = (fullname) => {
    if (!fullname) return null;
    const cleanName = fullname.split(' (')[0].trim().toLowerCase();
    return patients.find(p => p.fullname && p.fullname.toLowerCase() === cleanName)
      || orgPatientsList.find(p => p.fullname && p.fullname.toLowerCase() === cleanName) || null;
  };

  const findPatientById = (id) => {
    if (!id) return null;
    const numericId = Number(id);
    return patients.find(p => Number(p.id) === numericId)
      || orgPatientsList.find(p => Number(p.id) === numericId) || null;
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await api.get('/auth/staff/patients');
      if (response.data && response.data.patients) {
        setPatients(response.data.patients);
      }
    } catch (err) {
      console.error('Error fetching staff patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchReferrals();
    fetchOrganizations();
    fetchOrganizationPatients();
    fetchAppointments();
  }, []);

  const openHealthRecord = async (patient) => {
    setSelectedPatient(patient);
    setIsHealthRecordModalOpen(true);
    setHealthRecordError('');
    setHealthRecordSuccess('');
    setIsEditingHealthRecord(false);
    setVerifyIdNumber('');
    setDbOnTreatment(false);
    
    // Set default empty state first
    setHealthRecord({
      blood_type: '',
      blood_pressure: '',
      weight: '',
      height: '',
      sugar_level: '',
      diagnosis: '',
      on_treatment: false,
      morning_time: '',
      midday_time: '',
      evening_time: '',
      admission_date: new Date().toISOString().split('T')[0],
      release_date: ''
    });
    setRoutines([]);
 
    try {
      const response = await api.get(`/auth/patients/${patient.id}/health-record`);
      if (response.data) {
        const hr = response.data.healthRecord || {};
        const onTreatmentVal = hr.on_treatment || false;
        setDbOnTreatment(onTreatmentVal);
        setHealthRecord({
          blood_type: hr.blood_type || '',
          blood_pressure: hr.blood_pressure || '',
          weight: hr.weight || '',
          height: hr.height || '',
          sugar_level: hr.sugar_level || '',
          diagnosis: hr.diagnosis || '',
          on_treatment: onTreatmentVal,
          morning_time: hr.morning_time || '',
          midday_time: hr.midday_time || '',
          evening_time: hr.evening_time || '',
          admission_date: hr.admission_date ? hr.admission_date.split('T')[0] : new Date().toISOString().split('T')[0],
          release_date: hr.release_date ? hr.release_date.split('T')[0] : ''
        });
        
        // Map routine statuses
        const routinesList = (response.data.routines || []).map(r => ({
          ...r,
          weekly: r.weekly || false,
          monthly: r.monthly || false,
          status: r.status || false
        }));
        setRoutines(routinesList);
      }
    } catch (err) {
      console.error('Error fetching health record:', err);
      setHealthRecordError('Failed to fetch patient health record from server.');
    }
  };

  const handleAddRoutine = () => {
    setRoutines([
      ...routines,
      {
        id: null,
        weekly: false,
        monthly: false,
        weekday: 'Monday',
        day_of_month: 1,
        time: '08:00',
        description: 'Doctor visit / checkup',
        status: false
      }
    ]);
  };

  const handleRemoveRoutine = (index) => {
    const updated = [...routines];
    updated.splice(index, 1);
    setRoutines(updated);
  };

  const handleRoutineChange = (index, field, value) => {
    const updated = [...routines];
    if (field === 'weekly' && value) {
      updated[index].monthly = false;
    } else if (field === 'monthly' && value) {
      updated[index].weekly = false;
    }
    updated[index][field] = value;
    setRoutines(updated);
  };

  const handleSaveHealthRecord = async (e) => {
    e.preventDefault();
    setSavingHealthRecord(true);
    setHealthRecordError('');
    setHealthRecordSuccess('');

    // Verify patient identity number
    if (!verifyIdNumber || verifyIdNumber.trim() !== selectedPatient.id_number.trim()) {
      setHealthRecordError("Identity verification failed. The entered ID number does not match the patient's record.");
      setSavingHealthRecord(false);
      return;
    }

    try {
      const payload = {
        ...healthRecord,
        routines,
        patient_id_number: verifyIdNumber.trim()
      };
      await api.put(`/auth/patients/${selectedPatient.id}/health-record`, payload);
      setHealthRecordSuccess('Health record and routines updated successfully!');
      
      setTimeout(() => {
        setIsHealthRecordModalOpen(false);
        setSelectedPatient(null);
        setIsEditingHealthRecord(false);
        setVerifyIdNumber('');
      }, 1500);
    } catch (err) {
      console.error('Error updating health record:', err);
      setHealthRecordError(err.response?.data?.message || 'Failed to update patient health record.');
    } finally {
      setSavingHealthRecord(false);
    }
  };

  const sidebarItems = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'vitals', name: 'Patient Vitals', icon: Heart },
    { id: 'referrals', name: 'Referrals', icon: ArrowLeftRight },
    { id: 'chat', name: 'Chat Room', icon: MessageSquare }
  ];

  const filteredPatients = orgPatientsList.filter(p => 
    p.fullname.toLowerCase().includes(patientQuery.toLowerCase())
  );
  const filteredOrgs = organizationsList.filter(org => 
    org.toLowerCase().includes(orgQuery.toLowerCase())
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
              <ShieldCheck className="h-5 w-5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              UbuntuHealth
            </span>
          </div>

          {/* User Details Block */}
          <div className="p-6 border-b border-slate-800/80 bg-slate-950/30">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-full bg-slate-800 flex items-center justify-center text-sm font-extrabold border border-slate-700 text-teal-400 shrink-0">
                {user.name ? user.name.split(' ').map(n=>n[0]).join('').toUpperCase() : 'CS'}
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-slate-200 text-sm truncate">{user.name}</h3>
                <p className="text-slate-500 text-xs truncate mb-1">{user.email || 'No email registered'}</p>
                <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  {user.staff_role || 'Staff'}
                </span>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="mt-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline block text-left transition-colors duration-200"
                >
                  View Profile
                </button>
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
                      ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/5 text-emerald-400 border border-emerald-500/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.name}
                  {item.id === 'chat' && notifications.some(n => n.type === 'message') && (
                    <span className="ml-auto bg-emerald-500 text-slate-950 rounded-full text-[10px] font-extrabold px-1.5 py-0.5 animate-pulse">
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
        <div className="absolute top-[-15%] right-[-15%] w-[600px] h-[600px] bg-emerald-950/10 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Top Header Bar */}
        <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-900/40 backdrop-blur-md relative z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-wide capitalize">
              {activeTab === 'vitals' ? 'Patient Vitals & Records' : activeTab === 'appointments' ? 'My Appointments Schedule' : activeTab}
            </h1>
            <span className="text-xs text-slate-500 font-mono">| Clinical staff Portal</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Clinical Session Secure
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors relative"
              >
                <Bell className="h-4.5 w-4.5" />
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full text-[9px] font-extrabold h-4 w-4 flex items-center justify-center animate-pulse">
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
                      className="text-[10px] text-emerald-400 hover:text-emerald-350 font-semibold"
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
                              {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
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

        {/* Dynamic Inner Clinical Staff Pages */}
        <section className="flex-grow p-8 overflow-y-auto relative z-10 max-w-5xl w-full mx-auto">
          
          {/* ================= PAGE: OVERVIEW ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-emerald-950/30 to-slate-900/30 border border-emerald-500/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-100">Welcome back, {user.name.split(' ')[0]}</h2>
                  <p className="text-slate-400 text-xs">Review patient vitals, clinical conditions, and manage scheduled check-ups.</p>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold">
                  <CheckCircle className="h-4 w-4" /> Portal Active
                </div>
              </div>

              {/* Health stats block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: 'Registered Patients', value: patients.length.toString(), desc: 'In your organization', icon: Users, color: 'text-rose-400 bg-rose-500/10 border-rose-500/25' },
                  { title: 'Appointments Today', value: `${appointments.filter(a => a.status === 'attended').length} / ${appointments.length}`, desc: 'Progress check', icon: Clock, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
                  { title: 'Role Specialty', value: user.staff_role, desc: 'Assigned credentials', icon: ShieldCheck, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25' }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <span className="text-slate-500 text-xs font-semibold tracking-wide uppercase">{stat.title}</span>
                        <h3 className="text-lg font-bold text-white capitalize">{stat.value}</h3>
                        <p className="text-[11px] text-slate-400">{stat.desc}</p>
                      </div>
                      <div className={`h-11 w-11 rounded-xl border flex items-center justify-center ${stat.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Today's Appointments Checklist */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <h3 className="font-bold text-slate-200">Today’s Appointments Checklist</h3>
                  <button 
                    onClick={() => setActiveTab('appointments')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    View Full List
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {appointments.length === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">No appointments scheduled for you today.</p>
                  ) : (
                    appointments.slice(0, 5).map((app) => (
                      <div key={app.id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleUpdateAppointmentStatus(app.id, app.status === 'attended' ? 'approved' : 'attended')}
                            disabled={app.status !== 'approved' && app.status !== 'attended'}
                            className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                              app.status === 'attended'
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold cursor-pointer'
                                : app.status === 'approved'
                                  ? 'border-slate-700 hover:border-emerald-500/50 bg-slate-950 cursor-pointer'
                                  : 'border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            {app.status === 'attended' && <CheckCircle className="h-3.5 w-3.5" />}
                          </button>
                          <div>
                            <p className={`font-semibold text-sm ${app.status === 'attended' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                              {app.fullname}
                            </p>
                            <p className="text-xs text-slate-550 mt-0.5">
                              {app.department_to} · {app.reason}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {app.arrival_date ? app.arrival_date.split('T')[0] : ''} {app.arrival_time || ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ================= PAGE: APPOINTMENTS ================= */}
          {activeTab === 'appointments' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="pb-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-200">Scheduled Clinical Appointments</h3>
                <p className="text-slate-500 text-xs mt-1">Manage slots requested for your consultation.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Scheduled Date</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingAppointments ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading appointments...
                        </td>
                      </tr>
                    ) : appointments.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500 text-xs">
                          No appointments scheduled for you.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((app) => {
                        let statusColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                        if (app.status === 'approved') statusColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        if (app.status === 'rejected') statusColor = 'bg-red-500/10 text-red-400 border border-red-500/20';
                        if (app.status === 'attended') statusColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';

                        const patientObj = app.patient_id 
                          ? (findPatientById(app.patient_id) || { id: app.patient_id, fullname: app.fullname }) 
                          : findPatientByName(app.fullname);

                        return (
                          <tr key={app.id} className="hover:bg-slate-800/20 transition-colors cursor-pointer" onClick={() => openHealthRecord(patientObj)}>
                            <td className="py-3.5 px-4">
                              {patientObj ? (
                                <p
                                  className="block font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer text-left bg-transparent border-0 p-0 transition-colors focus:outline-none"
                                >
                                  {app.fullname}
                                </p>
                              ) : (
                                <span className="block font-bold text-slate-200">{app.fullname}</span>
                              )}
                              <span className="block text-slate-500 text-xs mt-0.5">{app.phone_number || 'No contact phone'}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-350 text-xs">{app.department_to}</td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                              {app.arrival_date ? app.arrival_date.split('T')[0] : 'N/A'}
                              <span className="block text-slate-500 mt-0.5">at {app.arrival_time || 'anytime'}</span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate" title={app.reason}>
                              {app.reason}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex gap-2 justify-center items-center">
                                {app.status === 'pending approval' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'approved')}
                                      className="py-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'rejected')}
                                      className="py-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-slate-950 border border-red-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                
                                {app.status === 'approved' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'attended')}
                                      className="py-1 px-2.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border border-sky-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Attended
                                    </button>
                                    <button
                                      onClick={() => handleUpdateAppointmentStatus(app.id, 'rejected')}
                                      className="py-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-slate-950 border border-red-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {(app.status === 'attended' || app.status === 'rejected') && (
                                  <span className="text-slate-500 text-[10px] italic">No actions available</span>
                                )}
                              </div>
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

          {/* ================= PAGE: PATIENT VITALS & DIRECTORY ================= */}
          {activeTab === 'vitals' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Patient Directory</h3>
                  <p className="text-slate-500 text-xs">Access health records, configure treatments, and log vitals.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={vitalsSearchQuery}
                    onChange={(e) => setVitalsSearchQuery(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 w-64 transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Address Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingPatients ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading patients directory...
                        </td>
                      </tr>
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          No patients found in your organization.
                        </td>
                      </tr>
                    ) : patients.filter(p => {
                      const query = vitalsSearchQuery.toLowerCase();
                      return p.fullname?.toLowerCase().includes(query) || p.id_number?.includes(query);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-500">
                          No patients matched your search.
                        </td>
                      </tr>
                    ) : (
                      patients
                        .filter(p => {
                          const query = vitalsSearchQuery.toLowerCase();
                          return p.fullname?.toLowerCase().includes(query) || p.id_number?.includes(query);
                        })
                        .map((pt) => (
                          <tr 
                            key={pt.id} 
                            onClick={() => openHealthRecord(pt)} 
                            className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-200 hover:text-emerald-400">
                              {pt.fullname}
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5 font-normal">Patient ID: PT-{pt.id}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {pt.gender}, {calculateAgeFromId(pt.id_number)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-350">
                              <span className="block text-slate-200">{pt.phone_number}</span>
                              <span className="block text-xs text-slate-500">{pt.email || 'No email registered'}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {pt.house_number} {pt.surbub}, {pt.city}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= PAGE: REFERRALS ================= */}
          {activeTab === 'referrals' && (
            <div className="space-y-6">
              {/* Incoming Referrals */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-slate-200">Incoming Referrals</h3>
                    <p className="text-slate-500 text-xs">Patients referred to you specifically</p>
                  </div>
                  <button 
                    onClick={() => { setIsReferralModalOpen(true); fetchOrganizations(); fetchOrganizationPatients(); }}
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
                        <th className="py-3 px-4">Origin / Referrer</th>
                        <th className="py-3 px-4">Department & Destination</th>
                        <th className="py-3 px-4">Arrival Date / Time</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {loadingReferrals ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                            Loading incoming referrals...
                          </td>
                        </tr>
                      ) : referrals.incoming.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-8 text-center text-slate-500">
                            No incoming referrals found.
                          </td>
                        </tr>
                      ) : (
                        referrals.incoming.map((ref) => (
                          <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors cursor-pointer" onClick={() => openHealthRecord(findPatientByName(ref.personel))}>
                            <td className="py-3.5 px-4 font-bold">
                              {(() => {
                                const patientObj = findPatientByName(ref.personel);
                                return patientObj ? (
                                  <button
                                    // onClick={() => openHealthRecord(patientObj)}
                                    className="block font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer text-left bg-transparent border-0 p-0 transition-colors focus:outline-none"
                                  >
                                    {ref.personel}
                                  </button>
                                ) : (
                                  <span className="block text-slate-200">{ref.personel}</span>
                                );
                              })()}
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5 font-normal">Ref ID: #{ref.id}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <span className="block capitalize">{ref.referrer_role}</span>
                              <span className="block text-xs text-slate-550">ID: {ref.referrer_id}</span>
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
                            <td className="py-3.5 px-4">
                              {!ref.status ? (
                                <button
                                  onClick={() => handleUpdateReferralStatus(ref.id)}
                                  className="py-1 px-2.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                                >
                                  Mark Attended
                                </button>
                              ) : (
                                <span className="text-emerald-500 text-xs font-semibold">Complete</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Outgoing Referrals */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="pb-4 border-b border-slate-800">
                  <h3 className="font-bold text-slate-200">Outgoing Referrals</h3>
                  <p className="text-slate-500 text-xs">Patients you have referred to other health networks</p>
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
                            Loading outgoing referrals...
                          </td>
                        </tr>
                      ) : referrals.outgoing.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-slate-500">
                            No outgoing referrals found.
                          </td>
                        </tr>
                      ) : (
                        referrals.outgoing.map((ref) => (
                          <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 px-4 font-bold">
                              {(() => {
                                const patientObj = findPatientByName(ref.personel);
                                return patientObj ? (
                                  <button
                                    onClick={() => openHealthRecord(patientObj)}
                                    className="block font-bold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer text-left bg-transparent border-0 p-0 transition-colors focus:outline-none"
                                  >
                                    {ref.personel}
                                  </button>
                                ) : (
                                  <span className="block text-slate-200">{ref.personel}</span>
                                );
                              })()}
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5 font-normal">Ref ID: #{ref.id}</span>
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
              <h2 className="text-xl font-bold text-white">Staff Profile</h2>
              <p className="text-slate-400 text-xs mt-1">Manage and view your staff profile details.</p>
            </div>

            {profileLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
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
                    className="mt-2 text-xs font-semibold text-emerald-400 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                {profileSuccess && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-300 font-semibold">{profileSuccess}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      disabled={!isEditingProfile}
                      value={profileForm.fullname}
                      onChange={(e) => setProfileForm({ ...profileForm, fullname: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-medium transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Gender</label>
                    <select
                      required
                      disabled={!isEditingProfile}
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-medium transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      disabled={!isEditingProfile}
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">House Number</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileForm.house_number}
                      onChange={(e) => setProfileForm({ ...profileForm, house_number: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Suburb</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileForm.surbub}
                      onChange={(e) => setProfileForm({ ...profileForm, surbub: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Municipality</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileForm.municipality}
                      onChange={(e) => setProfileForm({ ...profileForm, municipality: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">City</label>
                    <input
                      type="text"
                      disabled={!isEditingProfile}
                      value={profileForm.city}
                      onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Employee ID (Uneditable)</span>
                    <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-mono select-none">
                      {profileData?.employee_id || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Identity Number (Uneditable)</span>
                    <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-mono select-none">
                      {profileData?.id_number || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Staff Role (Uneditable)</span>
                    <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-medium select-none capitalize">
                      {profileData?.staff_role || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Organization (Uneditable)</span>
                    <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-medium select-none">
                      {profileData?.organization || '—'}
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
                            city: profileData?.city || ''
                          });
                          setProfileError('');
                          setProfileSuccess('');
                        }}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-all duration-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                      >
                        {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-2.5 bg-slate-850 border border-slate-700/60 hover:bg-slate-800 text-emerald-400 font-bold rounded-xl text-sm transition-all duration-300"
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

      {/* ================= PATIENT HEALTH RECORD MODAL ================= */}
      {isHealthRecordModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsHealthRecordModalOpen(false); setSelectedPatient(null); setHealthRecordError(''); setHealthRecordSuccess(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <div className="flex justify-between items-baseline">
                <h2 className="text-xl font-bold text-white">Clinical Record: {selectedPatient.fullname}</h2>
                <span className="text-xs text-slate-500 font-mono">Patient ID: PT-{selectedPatient.id}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">Review diagnostic measurements, configure active treatments, and update scheduled care routines.</p>
            </div>

            {/* Error & Success Notification */}
            {healthRecordError && (
              <div className="bg-red-950/40 border border-red-500/25 text-red-300 p-3.5 rounded-xl text-xs">
                <span>{healthRecordError}</span>
              </div>
            )}
            {healthRecordSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 p-3.5 rounded-xl text-xs">
                <span>{healthRecordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveHealthRecord} className="space-y-6">
              
              {/* Grid 1: Clinical Diagnostics */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Clinical Measurements</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Blood Type</label>
                    <input
                      type="text"
                      placeholder="e.g. O+"
                      value={healthRecord.blood_type}
                      onChange={(e) => setHealthRecord({...healthRecord, blood_type: e.target.value})}
                      disabled={!isEditingHealthRecord}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Blood Pressure</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="mmHg"
                      value={healthRecord.blood_pressure}
                      onChange={(e) => setHealthRecord({...healthRecord, blood_pressure: e.target.value})}
                      disabled={!isEditingHealthRecord}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Sugar Level</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="mmol/L"
                      value={healthRecord.sugar_level}
                      onChange={(e) => setHealthRecord({...healthRecord, sugar_level: e.target.value})}
                      disabled={!isEditingHealthRecord}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Weight (kg)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="kg"
                      value={healthRecord.weight}
                      onChange={(e) => setHealthRecord({...healthRecord, weight: e.target.value})}
                      disabled={!isEditingHealthRecord}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-60"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Height (cm)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="cm"
                      value={healthRecord.height}
                      onChange={(e) => setHealthRecord({...healthRecord, height: e.target.value})}
                      disabled={!isEditingHealthRecord}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Diagnosis Field */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">Primary Diagnosis Summary</label>
                <textarea
                  rows={2}
                  placeholder="Record primary symptoms, diagnoses, or notes..."
                  value={healthRecord.diagnosis}
                  onChange={(e) => setHealthRecord({...healthRecord, diagnosis: e.target.value})}
                  disabled={!isEditingHealthRecord}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors resize-none disabled:opacity-60"
                />
              </div>

              {/* Treatment & Time configuration */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Treatment Schedule</h3>
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={healthRecord.on_treatment}
                      onChange={(e) => setHealthRecord({...healthRecord, on_treatment: e.target.checked})}
                      disabled={!isEditingHealthRecord || healthRecord.on_treatment === true}
                      className="h-4 w-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 disabled:opacity-60"
                    />
                    Patient is on active treatment
                  </label>
                </div>

                {healthRecord.on_treatment && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-405 font-semibold">Morning Medication Time</label>
                      <input
                        type="time"
                        value={healthRecord.morning_time}
                        onChange={(e) => setHealthRecord({...healthRecord, morning_time: e.target.value})}
                        disabled={!isEditingHealthRecord}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-405 font-semibold">Midday Medication Time</label>
                      <input
                        type="time"
                        value={healthRecord.midday_time}
                        onChange={(e) => setHealthRecord({...healthRecord, midday_time: e.target.value})}
                        disabled={!isEditingHealthRecord}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-405 font-semibold">Evening Medication Time</label>
                      <input
                        type="time"
                        value={healthRecord.evening_time}
                        onChange={(e) => setHealthRecord({...healthRecord, evening_time: e.target.value})}
                        disabled={!isEditingHealthRecord}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors disabled:opacity-60"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Care Routines Checklist */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Scheduled Routines</h3>
                  {isEditingHealthRecord && (
                    <button
                      type="button"
                      onClick={handleAddRoutine}
                      className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Routine
                    </button>
                  )}
                </div>

                <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
                  {routines.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                      No routines configured. {isEditingHealthRecord && 'Click "Add Routine" to set up care schedules.'}
                    </div>
                  ) : (
                    routines.map((routine, idx) => (
                      <div key={idx} className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3 relative group">
                        
                        {/* Remove button */}
                        {isEditingHealthRecord && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRoutine(idx)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Description */}
                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">Routine Type</label>
                            <select
                              value={routine.description || 'Doctor visit/ checkup'}
                              onChange={(e) => handleRoutineChange(idx, 'description', e.target.value)}
                              disabled={!isEditingHealthRecord}
                              className="bg-slate-900 border border-slate-850 rounded-xl py-1.5 px-3 w-full text-slate-200 outline-none text-xs disabled:opacity-60"
                            >
                              <option value="Doctor visit/ checkup">Doctor visit / checkup</option>
                              <option value="medicine refill">Medicine refill</option>
                            </select>
                          </div>

                          {/* Time */}
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-[10px] text-slate-500 font-semibold uppercase">Target Time</label>
                            <input
                              type="time"
                              value={routine.time || '08:00'}
                              onChange={(e) => handleRoutineChange(idx, 'time', e.target.value)}
                              disabled={!isEditingHealthRecord}
                              className="bg-slate-900 border border-slate-855 rounded-xl py-1.5 px-3 w-full text-slate-200 outline-none font-mono text-xs disabled:opacity-60"
                            />
                          </div>

                          {/* Frequency options */}
                          <div className="md:col-span-4 flex items-center gap-4 pt-4">
                            <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={routine.weekly}
                                onChange={(e) => handleRoutineChange(idx, 'weekly', e.target.checked)}
                                disabled={!isEditingHealthRecord}
                                className="h-4 w-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-900 disabled:opacity-60"
                              />
                              Weekly
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={routine.monthly}
                                onChange={(e) => handleRoutineChange(idx, 'monthly', e.target.checked)}
                                disabled={!isEditingHealthRecord}
                                className="h-4 w-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-900 disabled:opacity-60"
                              />
                              Monthly
                            </label>
                          </div>

                          {/* Status Checklist */}
                          <div className="md:col-span-2 flex items-center pt-4">
                            <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={routine.status}
                                onChange={(e) => handleRoutineChange(idx, 'status', e.target.checked)}
                                disabled={!isEditingHealthRecord}
                                className="h-4 w-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-900 disabled:opacity-60"
                              />
                              Attended
                            </label>
                          </div>
                        </div>

                        {/* Conditional weekday / day_of_month selection */}
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-2 text-xs">
                          {routine.weekly && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-semibold uppercase">Weekday</label>
                              <select
                                value={routine.weekday || 'Monday'}
                                onChange={(e) => handleRoutineChange(idx, 'weekday', e.target.value)}
                                disabled={!isEditingHealthRecord}
                                className="bg-slate-900 border border-slate-850 rounded-xl py-1.5 px-3 w-full text-slate-200 outline-none disabled:opacity-60"
                              >
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {routine.monthly && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-semibold uppercase">Day of Month</label>
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={routine.day_of_month || 1}
                                onChange={(e) => handleRoutineChange(idx, 'day_of_month', parseInt(e.target.value, 10))}
                                disabled={!isEditingHealthRecord}
                                className="bg-slate-900 border border-slate-850 rounded-xl py-1.5 px-3 w-full text-slate-200 outline-none font-mono disabled:opacity-60"
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Patient Identity verification input field (required when editing) */}
              {isEditingHealthRecord && (
                <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-2xl space-y-2 animate-fadeIn">
                  <label className="text-xs text-slate-350 font-semibold block">
                    Verify Patient Identity to Save Changes
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Patient's 13-digit ID Number"
                    value={verifyIdNumber}
                    onChange={(e) => setVerifyIdNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-500">
                    You must enter the patient's registered identity number to verify and authorize this modification.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                {!isEditingHealthRecord ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setIsHealthRecordModalOpen(false); setSelectedPatient(null); }}
                      className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                    >
                      Close Profile
                    </button>
                    {user.staff_role === 'doctor/nurse' && (
                      <button
                        type="button"
                        onClick={() => setIsEditingHealthRecord(true)}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all"
                      >
                        Edit Health Record
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setIsEditingHealthRecord(false); setVerifyIdNumber(''); }}
                      className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingHealthRecord}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {savingHealthRecord && <Loader2 className="h-5 w-5 animate-spin" />}
                      {savingHealthRecord ? 'Saving Record...' : 'Save Health Record'}
                    </button>
                  </>
                )}
              </div>

            </form>

          </div>
        </div>
      )}
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
              <p className="text-slate-400 text-xs mt-1">Initiate a transfer to another medical facility or staff member.</p>
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
                {/* Destination Organization */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-400 font-semibold">Target Organization *</label>
                    <input 
                      type="text" 
                      placeholder="Search organization..." 
                      value={orgQuery}
                      onChange={e => setOrgQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-650 outline-none focus:border-emerald-500 w-32 transition-colors"
                    />
                  </div>
                  <select
                    required
                    value={referralForm.organization_to}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">-- Choose Organization --</option>
                    {filteredOrgs.map(org => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>
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
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : toast.type === 'referral' 
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
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

export default StaffDashboard;

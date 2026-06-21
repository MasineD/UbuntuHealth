import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, Calendar, ArrowLeftRight, MessageSquare, LogOut, Loader2,ShieldCheck,Search,Bell,Plus,Send,User as UserIcon,CheckCircle,FileText,Clock,Menu,ChevronRight,X, Activity, AlertTriangle
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

function Dashboard({ user, onLogout, actionLoading, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'patients' | 'appointments' | 'referrals' | 'chat'
  const [searchQuery, setSearchQuery] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileForm, setProfileForm] = useState({ fullname: '', phone_number: '', email: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const fetchProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await api.get(`${API_URL}/auth/profile`);
      if (res.data && res.data.profile) {
        setProfileData(res.data.profile);
        setProfileForm({
          fullname: res.data.profile.fullname || '',
          phone_number: res.data.profile.phone_number || '',
          email: res.data.profile.email || ''
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
      const res = await api.put(`${API_URL}/auth/profile`, profileForm);
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
        const orgRes = await api.get(`${API_URL}/auth/my-organization`);
        if (!active) return;
        const orgName = orgRes.data.organization;
        if (!orgName) return;

        socketInstance = io(`${API_URL}`, { transports: ['websocket'] });
        
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
            type: data.type === 'compliance_alert' 
              ? 'compliance_alert' 
              : (data.type === 'home_visit_fulfilled' ? 'compliance_alert' : (data.type === 'referral_created' ? 'referral' : 'appointment')),
            title: data.title,
            message: data.message
          };
          setToasts(prev => [...prev, newToast]);

          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
          }, 5000);

          if (data.type === 'compliance_alert' || data.type === 'home_visit_fulfilled') {
            fetchComplianceAlerts();
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
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [hiddenAlertIds, setHiddenAlertIds] = useState([]);
  const activeTimeoutsRef = useRef({});
  const [isScheduleVisitModalOpen, setIsScheduleVisitModalOpen] = useState(false);
  const [selectedAlertForVisit, setSelectedAlertForVisit] = useState(null);
  const [selectedChwId, setSelectedChwId] = useState('');
  const [visitReason, setVisitReason] = useState('Medication Non-Compliance Follow-up');
  const [visitDate, setVisitDate] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Appointments administrative state
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentGroup, setAppointmentGroup] = useState('our-patients'); // 'our-patients' | 'new-patients'

  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const response = await api.get(`${API_URL}/auth/appointments`);
      if (response.data && response.data.appointments) {
        setAppointments(response.data.appointments);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
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
      await api.put(`${API_URL}/auth/appointments/${appId}/status`, { status, key });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update appointment status');
    }
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await api.get(`${API_URL}/auth/patients`);
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

  const fetchComplianceAlerts = async () => {
    try {
      const response = await api.get(`${API_URL}/auth/admin/compliance-alerts`);
      if (response.data && response.data.complianceAlerts) {
        setComplianceAlerts(response.data.complianceAlerts);
      }
    } catch (err) {
      console.error('Error fetching compliance alerts:', err);
    }
  };

  const handleScheduleHomeVisit = (alert) => {
    setSelectedAlertForVisit(alert);
    setSelectedChwId('');
    if (alert.alert_type === 'routine') {
      setVisitReason(`Routine Task Non-Compliance Follow-up: ${alert.routine_description || ''}`);
    } else {
      setVisitReason('Medication Non-Compliance Follow-up');
    }
    setVisitDate(new Date().toISOString().split('T')[0]);
    setIsScheduleVisitModalOpen(true);
  };

  const submitScheduleHomeVisit = async () => {
    if (!selectedAlertForVisit || !selectedChwId || !visitDate) return;
    try {
      const response = await api.post(`${API_URL}/auth/admin/compliance-alerts/${selectedAlertForVisit.id}/schedule-visit`, {
        chwId: selectedChwId,
        reason: visitReason,
        date: visitDate
      });
      if (response.data) {
        setComplianceAlerts(prev => prev.map(a => 
          a.id === selectedAlertForVisit.id ? { ...a, visit_scheduled: true, visit_date: visitDate, visit_reason: visitReason } : a
        ));
        setIsScheduleVisitModalOpen(false);
        setSelectedAlertForVisit(null);
      }
    } catch (err) {
      console.error('Error scheduling home visit:', err);
    }
  };

  // Handle card disappearance 30 seconds after status changes to 'visitted'
  useEffect(() => {
    complianceAlerts.forEach(alert => {
      if (alert.visit_status === 'visitted' && !hiddenAlertIds.includes(alert.id)) {
        if (!activeTimeoutsRef.current[alert.id]) {
          const timeoutId = setTimeout(() => {
            setHiddenAlertIds(prev => [...prev, alert.id]);
            delete activeTimeoutsRef.current[alert.id];
          }, 30000); // 30 seconds
          activeTimeoutsRef.current[alert.id] = timeoutId;
        }
      }
    });

    // Cleanup timeouts for any alerts that are no longer in complianceAlerts
    const alertIds = complianceAlerts.map(a => a.id);
    Object.keys(activeTimeoutsRef.current).forEach(id => {
      if (!alertIds.includes(Number(id))) {
        clearTimeout(activeTimeoutsRef.current[id]);
        delete activeTimeoutsRef.current[id];
      }
    });
  }, [complianceAlerts, hiddenAlertIds]);

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      if (activeTimeoutsRef.current) {
        Object.values(activeTimeoutsRef.current).forEach(clearTimeout);
      }
    };
  }, []);

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
      const response = await api.get(`${API_URL}/auth/chws`);
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
      const response = await api.post(`${API_URL}/auth/register-chw`, chwForm);
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

  // Health Records state
  const [selectedPatient, setSelectedPatient] = useState(null);
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
  const [routinesList, setRoutinesList] = useState([]);
  const [isPatientDetailsModalOpen, setIsPatientDetailsModalOpen] = useState(false);
  const openPatientDetails = (patient) => {
    setSelectedPatient(patient);
    setIsPatientDetailsModalOpen(true);
  };

  // Clinical Staff state
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffModalLoading, setStaffModalLoading] = useState(false);
  const [staffModalError, setStaffModalError] = useState('');
  const [staffModalSuccess, setStaffModalSuccess] = useState('');

  const [staffForm, setStaffForm] = useState({
    employee_id: '',
    fullname: '',
    id_number: '',
    gender: 'Male',
    role: 'doctor/nurse',
    password: '',
    email: '',
    phone_number: '',
    house_number: '',
    surbub: '',
    municipality: '',
    city: ''
  });

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const response = await api.get(`${API_URL}/auth/staff`);
      if (response.data && response.data.staff) {
        setStaff(response.data.staff);
      }
    } catch (err) {
      console.error('Error fetching clinical staff:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    setStaffModalError('');
    setStaffModalSuccess('');
    
    if (staffForm.id_number.length !== 13) {
      setStaffModalError('National ID must be exactly 13 digits');
      return;
    }
    if (staffForm.phone_number.length !== 10) {
      setStaffModalError('Phone number must be exactly 10 digits');
      return;
    }

    setStaffModalLoading(true);
    try {
      const response = await api.post(`${API_URL}/auth/register-staff`, staffForm);
      if (response.data && response.data.staff) {
        setStaffModalSuccess('Clinical staff member registered successfully!');
        
        // Add new staff member to state list
        const newStaff = response.data.staff;
        setStaff([
          ...staff,
          {
            ...staffForm,
            id: newStaff.id,
            staff_role: newStaff.role
          }
        ]);

        // Reset form
        setStaffForm({
          employee_id: '',
          fullname: '',
          id_number: '',
          gender: 'Male',
          role: 'doctor/nurse',
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
          setIsStaffModalOpen(false);
          setStaffModalSuccess('');
        }, 1500);
      }
    } catch (err) {
      setStaffModalError(err.response?.data?.message || 'Failed to register clinical staff member');
    } finally {
      setStaffModalLoading(false);
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
      const response = await api.get(`${API_URL}/auth/referrals`);
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
      const response = await api.get(`${API_URL}/auth/organizations`);
      if (response.data && response.data.organizations) {
        setOrganizationsList(response.data.organizations);
      }
    } catch (err) {
      console.error('Error fetching organizations list:', err);
    }
  };

  const fetchOrganizationPatients = async () => {
    try {
      const response = await api.get(`${API_URL}/auth/organization-patients`);
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
      const response = await api.get(`${API_URL}/auth/organizations/${encodeURIComponent(orgName)}/staff`);
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
      await api.post(`${API_URL}/auth/referrals`, referralForm);
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
      await api.put(`${API_URL}/auth/referrals/${refId}/status`, { key });
      fetchReferrals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update referral status');
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchChws();
    fetchStaff();
    fetchReferrals();
    fetchOrganizations();
    fetchOrganizationPatients();
    fetchAppointments();
    fetchComplianceAlerts();
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
      const response = await api.post(`${API_URL}/auth/register-patient`, patientForm);
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
    { id: 'staff', name: 'Clinical Staff', icon: ShieldCheck },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
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
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="mt-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline block text-left transition-colors duration-200"
                >
                  View Profile
                </button>
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
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
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
                            <span className="text-[9px] text-slate-505 font-mono">
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

              {/* Patient Compliance Section */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="pb-4 border-b border-slate-800">
                  <h3 className="font-bold text-slate-200">Patient Compliance</h3>
                  <p className="text-slate-500 text-xs">Patients who have missed their scheduled medication today</p>
                </div>
                {complianceAlerts.filter(alert => !hiddenAlertIds.includes(alert.id)).length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">All patients are compliant today.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {complianceAlerts.filter(alert => !hiddenAlertIds.includes(alert.id)).map((alert) => (
                      <div key={alert.id} className="group relative bg-slate-950/40 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-4 overflow-hidden">
                        
                        {/* Hover summary notes */}
                        {alert.visit_status === 'visitted' && alert.visit_notes && (
                          <div className="absolute inset-0 bg-slate-950/95 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-center items-center text-center z-10 pointer-events-none">
                            <span className="text-xs text-emerald-400 font-semibold mb-1 uppercase tracking-wider font-mono">Visit Notes</span>
                            <p className="text-xs text-slate-300 leading-relaxed max-w-xs">{alert.visit_notes}</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-200 text-sm">{alert.patient_name}</h4>
                              <p className="text-xs text-slate-500">ID: {alert.patient_id_number || 'N/A'}</p>
                            </div>
                            {alert.visit_status === 'visitted' ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                Visited
                              </span>
                            ) : alert.alert_type === 'routine' ? (
                              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                Missed Routine
                              </span>
                            ) : (
                              <span className="bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                Did not take medication
                              </span>
                            )}
                          </div>

                          {alert.alert_type === 'routine' && (
                            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5 my-2">
                              <div className="text-slate-350">
                                <strong>Routine Task:</strong> <span className="text-slate-200 font-medium">{alert.routine_description}</span>
                              </div>
                              <div className="text-slate-350">
                                <strong>Scheduled Time:</strong> <span className="text-slate-200 font-mono">{alert.routine_time ? alert.routine_time.substring(0, 5) : 'N/A'}</span>
                              </div>
                              <div className="text-rose-400 font-medium">
                                <strong>Alert:</strong> Patient missed their routine checkup/refill.
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400 border-t border-slate-800/40 pt-2.5">
                            <div><strong>Phone:</strong> {alert.patient_phone || 'N/A'}</div>
                            <div><strong>Gender:</strong> {alert.patient_gender || 'N/A'}</div>
                            <div><strong>Address:</strong> {alert.patient_address || 'N/A'}</div>
                            <div className="col-span-2"><strong>Next of Kin:</strong> {alert.patient_next_of_kin || 'N/A'} ({alert.patient_next_of_kin_phone || 'N/A'})</div>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-slate-800/40">
                          {alert.visit_status === 'visitted' ? (
                            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                              Visited
                            </span>
                          ) : alert.visit_scheduled ? (
                            <button
                              disabled
                              className="py-1.5 px-3 bg-slate-800 text-slate-500 text-xs font-bold rounded-lg cursor-not-allowed"
                            >
                              Scheduled
                            </button>
                          ) : (
                            <button
                              onClick={() => handleScheduleHomeVisit(alert)}
                              className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              Schedule Home Visit
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                        <tr key={pt.id} onClick={() => openPatientDetails(pt)} className="hover:bg-slate-800/20 transition-colors cursor-pointer">
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

          {/* ================= PAGE: CLINICAL STAFF ================= */}
          {activeTab === 'staff' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-slate-200">Clinical Staff</h3>
                  <p className="text-slate-500 text-xs">List of registered clinical staff members in your organization</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search name, ID, specialty..."
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 w-60 transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => setIsStaffModalOpen(true)}
                    className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Add Staff Member
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="py-3 px-4">Name & Employee ID</th>
                      <th className="py-3 px-4">Role/Specialty</th>
                      <th className="py-3 px-4">Gender & Age</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">National ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loadingStaff ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          Loading clinical staff...
                        </td>
                      </tr>
                    ) : staff.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          No clinical staff members found. Click "Add Staff Member" to register one.
                        </td>
                      </tr>
                    ) : staff.filter(cs => {
                      const query = staffSearchQuery.toLowerCase();
                      return (
                        cs.fullname?.toLowerCase().includes(query) ||
                        cs.employee_id?.toLowerCase().includes(query) ||
                        cs.staff_role?.toLowerCase().includes(query)
                      );
                    }).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-slate-500">
                          No clinical staff matched your search query.
                        </td>
                      </tr>
                    ) : (
                      staff
                        .filter(cs => {
                          const query = staffSearchQuery.toLowerCase();
                          return (
                            cs.fullname?.toLowerCase().includes(query) ||
                            cs.employee_id?.toLowerCase().includes(query) ||
                            cs.staff_role?.toLowerCase().includes(query)
                          );
                        })
                        .map((cs) => (
                          <tr key={cs.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-200">
                              {cs.fullname}
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Emp ID: {cs.employee_id}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                cs.staff_role === 'doctor/nurse' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : cs.staff_role === 'social worker'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              }`}>
                                {cs.staff_role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {cs.gender}, {calculateAgeFromId(cs.id_number)}
                            </td>
                            <td className="py-3.5 px-4 text-slate-350">
                              <span className="block text-slate-200">{cs.phone_number}</span>
                              <span className="block text-xs text-slate-500">{cs.email || 'No email provided'}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {cs.house_number} {cs.surbub}, {cs.city}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{cs.id_number}</td>
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
            <div className="space-y-6">
              
              {/* Group Toggle buttons */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-850">
                  <button
                    onClick={() => setAppointmentGroup('our-patients')}
                    className={`py-1.5 px-4 rounded-lg font-bold text-xs transition-all duration-300 ${
                      appointmentGroup !== 'new-patients'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                    }`}
                  >
                    From Our Patients ({appointments.filter(app => app.is_our_patient === true).length})
                  </button>
                  <button
                    onClick={() => setAppointmentGroup('new-patients')}
                    className={`py-1.5 px-4 rounded-lg font-bold text-xs transition-all duration-300 ${
                      appointmentGroup === 'new-patients'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                    }`}
                  >
                    From New Patients ({appointments.filter(app => app.is_our_patient !== true).length})
                  </button>
                </div>
                
                <p className="text-slate-500 text-xs font-medium">
                  Showing incoming requests scheduled to {user.organization}
                </p>
              </div>

              {/* Appointments List Panel */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-200 text-base">
                      {appointmentGroup === 'new-patients' ? 'External / New Patient Bookings' : 'Registered Patient Bookings'}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      {appointmentGroup === 'new-patients' 
                        ? 'Requests from unregistered users or patients registered in other organizations.' 
                        : 'Requests from patients registered under your organization.'}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="py-3 px-4">Patient Details</th>
                        <th className="py-3 px-4">Department & Clinician</th>
                        <th className="py-3 px-4">Scheduled Date</th>
                        <th className="py-3 px-4">Reason for Visit</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Status Action</th>
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
                      ) : (
                        (appointmentGroup === 'new-patients' 
                          ? appointments.filter(app => app.is_our_patient !== true) 
                          : appointments.filter(app => app.is_our_patient === true)
                        ).length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-8 text-center text-slate-500 text-xs">
                              No appointments found in this group.
                            </td>
                          </tr>
                        ) : (
                          (appointmentGroup === 'new-patients' 
                            ? appointments.filter(app => app.is_our_patient !== true) 
                            : appointments.filter(app => app.is_our_patient === true)
                          ).map((app) => {
                            const isStaffAssigned = !!app.staff_to;
                            let statusColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                            if (app.status === 'approved') statusColor = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                            if (app.status === 'rejected') statusColor = 'bg-red-500/10 text-red-400 border border-red-500/20';
                            if (app.status === 'attended') statusColor = 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
                            
                            return (
                              <tr key={app.id} className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3.5 px-4">
                                  <span className="block font-bold text-slate-200">{app.fullname}</span>
                                  <span className="block text-slate-500 text-xs mt-0.5">{app.phone_number || 'No contact phone'}</span>
                                </td>
                                <td className="py-3.5 px-4 text-xs">
                                  <span className="block text-slate-300 font-semibold">{app.department_to}</span>
                                  <span className="block text-slate-500 mt-0.5">
                                    Recipient: {isStaffAssigned ? app.staff_to : 'Organization Admin (You)'}
                                  </span>
                                </td>
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
                                  {isStaffAssigned ? (
                                    <span className="text-[10px] text-slate-500 italic block max-w-[150px] mx-auto leading-tight">
                                      Clinician Assigned: Only recipient can update status
                                    </span>
                                  ) : (
                                    <div className="flex gap-2 justify-center items-center">
                                      {app.status === 'pending approval' && (
                                        <button
                                          onClick={() => handleUpdateAppointmentStatus(app.id, 'approved')}
                                          className="py-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                      )}
                                      
                                      {app.status === 'approved' && (
                                        <button
                                          onClick={() => handleUpdateAppointmentStatus(app.id, 'attended')}
                                          className="py-1 px-2.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border border-sky-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                          Attended
                                        </button>
                                      )}

                                      {(app.status === 'pending approval' || app.status === 'approved') && (
                                        <button
                                          onClick={() => handleUpdateAppointmentStatus(app.id, 'rejected')}
                                          className="py-1 px-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-slate-950 border border-red-500/25 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                          Reject
                                        </button>
                                      )}

                                      {(app.status === 'attended' || app.status === 'rejected') && (
                                        <span className="text-slate-500 text-[10px] italic">No actions available</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )
                      )}
                    </tbody>
                  </table>
                </div>
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
                    <p className="text-slate-500 text-xs">Patients referred to {user.organization}</p>
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
                          <tr key={ref.id} className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-200">
                              {ref.personel}
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Ref ID: #{ref.id}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <span className="block capitalize">{ref.referrer_role}</span>
                              <span className="block text-xs text-slate-550">ID: {ref.referrer_id}</span>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="block text-slate-200">{ref.department_to}</span>
                              <span className="block text-slate-400 mt-0.5">Recipient: {ref.staff_to || 'Organization Admin'}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-350">
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
                              {!ref.status && !ref.staff_to ? (
                                <button
                                  onClick={() => handleUpdateReferralStatus(ref.id)}
                                  className="py-1 px-2.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                                >
                                  Mark Attended
                                </button>
                              ) : !ref.status && ref.staff_to ? (
                                <span className="text-slate-550 text-[10px] italic">Only designated staff can attend</span>
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
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-350">
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

      {/* ================= CLINICAL STAFF REGISTRATION MODAL ================= */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsStaffModalOpen(false); setStaffModalError(''); setStaffModalSuccess(''); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Register New Clinical Staff Member</h2>
              <p className="text-slate-400 text-xs mt-1">Provide all details to add the clinical staff member to the organization.</p>
            </div>

            {/* Error & Success Notification */}
            {staffModalError && (
              <div className="bg-red-950/40 border border-red-500/25 text-red-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{staffModalError}</span>
              </div>
            )}
            {staffModalSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/25 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
                <span>{staffModalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterStaff} className="space-y-6">
              
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
                      value={staffForm.fullname}
                      onChange={(e) => setStaffForm({...staffForm, fullname: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold">Gender *</label>
                      <select
                        value={staffForm.gender}
                        onChange={(e) => setStaffForm({...staffForm, gender: e.target.value})}
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
                        value={staffForm.id_number}
                        onChange={(e) => setStaffForm({...staffForm, id_number: e.target.value.replace(/\D/g, '')})}
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
                      placeholder="e.g. DOC-301"
                      value={staffForm.employee_id}
                      onChange={(e) => setStaffForm({...staffForm, employee_id: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Role/Specialty *</label>
                    <select
                      value={staffForm.role}
                      onChange={(e) => setStaffForm({...staffForm, role: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="doctor/nurse">Doctor / Nurse</option>
                      <option value="social worker">Social Worker</option>
                      <option value="therapist">Therapist</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit phone"
                      value={staffForm.phone_number}
                      onChange={(e) => setStaffForm({...staffForm, phone_number: e.target.value.replace(/\D/g, '')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                    <input
                      type="email"
                      placeholder="staff@hospital.com"
                      value={staffForm.email}
                      onChange={(e) => setStaffForm({...staffForm, email: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Portal Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Choose password"
                      value={staffForm.password}
                      onChange={(e) => setStaffForm({...staffForm, password: e.target.value})}
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
                      value={staffForm.house_number}
                      onChange={(e) => setStaffForm({...staffForm, house_number: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Suburb *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Melville"
                      value={staffForm.surbub}
                      onChange={(e) => setStaffForm({...staffForm, surbub: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">Municipality *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. City of Joburg"
                      value={staffForm.municipality}
                      onChange={(e) => setStaffForm({...staffForm, municipality: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold">City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Johannesburg"
                      value={staffForm.city}
                      onChange={(e) => setStaffForm({...staffForm, city: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-655 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsStaffModalOpen(false); setStaffModalError(''); setStaffModalSuccess(''); }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffModalLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {staffModalLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {staffModalLoading ? 'Registering Staff...' : 'Register Staff Member'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ================= PATIENT HEALTH RECORD MODAL ================= */}      {/* ================= PATIENT DETAILS MODAL ================= */}
      {isPatientDetailsModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsPatientDetailsModalOpen(false); setSelectedPatient(null); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-slate-800 pb-4">
              <div className="flex justify-between items-baseline">
                <h2 className="text-xl font-bold text-white">Patient Profile: {selectedPatient.name}</h2>
                <span className="text-xs text-slate-500 font-mono">Patient ID: {selectedPatient.id}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">Personal and registration details stored in the patients database.</p>
            </div>

            <div className="space-y-6">
              
              {/* Personal Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-800/80 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Full Name</span>
                    <span className="text-sm text-slate-200 font-medium">{selectedPatient.fullname}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Identity Number</span>
                    <span className="text-sm text-slate-200 font-mono">{selectedPatient.id_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Gender</span>
                    <span className="text-sm text-slate-200 font-medium">{selectedPatient.gender}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Age</span>
                    <span className="text-sm text-slate-200 font-medium">{selectedPatient.age}</span>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Contact & Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-800/80 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Email Address</span>
                    <span className="text-sm text-slate-200 truncate block">{selectedPatient.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Phone Number</span>
                    <span className="text-sm text-slate-200 font-mono">{selectedPatient.phone_number}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Residential Address</span>
                    <span className="text-sm text-slate-200">
                      {[
                        selectedPatient.house_number,
                        selectedPatient.surbub,
                        selectedPatient.municipality,
                        selectedPatient.city
                      ].filter(Boolean).join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Next of Kin Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Next of Kin Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-800/80 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Next of Kin Full Name</span>
                    <span className="text-sm text-slate-200 font-medium">{selectedPatient.next_of_kin_fullname || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Next of Kin Phone</span>
                    <span className="text-sm text-slate-200 font-mono">{selectedPatient.next_of_kin_phone || 'N/A'}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[10px] text-slate-550 block font-semibold uppercase">Next of Kin Email</span>
                    <span className="text-sm text-slate-200 block truncate">{selectedPatient.next_of_kin_email || 'N/A'}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsPatientDetailsModalOpen(false); setSelectedPatient(null); }}
                className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= PROFILE MODAL ================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Admin Profile</h2>
              <p className="text-slate-400 text-xs mt-1">Manage and view your user profile details.</p>
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

                <div className="space-y-4">
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
                    <label className="text-[10px] text-slate-400 block font-semibold uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      disabled={!isEditingProfile}
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 transition-all duration-300 disabled:opacity-50 disabled:bg-slate-950/40"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Identity Number (Uneditable)</span>
                      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-mono select-none">
                        {profileData?.identity || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase mb-1">Organization (Uneditable)</span>
                      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-medium select-none">
                        {profileData?.organization || '—'}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-[10px] text-slate-550 block font-semibold uppercase mb-1">Facility Code (Uneditable)</span>
                      <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-mono select-none">
                        {profileData?.facility_code || '—'}
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
                            phone_number: profileData?.phone_number || '',
                            email: profileData?.email || ''
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
      {/* ================= CREATE REFERRAL MODAL ================= */}
      {isReferralModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={closeReferralModal}
              className="absolute top-4 right-4 text-slate-550 hover:text-slate-350 transition-colors"
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
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500 w-48 transition-colors"
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
                      className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500 w-32 transition-colors"
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
                      className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500 w-32 transition-colors"
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
                    className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500 w-48 transition-colors"
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

      {/* ================= SCHEDULE HOME VISIT MODAL ================= */}
      {isScheduleVisitModalOpen && selectedAlertForVisit && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl relative animate-scaleUp">
            
            {/* Close Button */}
            <button 
              onClick={() => { setIsScheduleVisitModalOpen(false); setSelectedAlertForVisit(null); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white">Schedule Home Visit</h2>
              <p className="text-slate-400 text-xs mt-1">Assign a community health worker to visit {selectedAlertForVisit.patient_name}.</p>
            </div>

            <div className="space-y-4">
              {/* CHW Selection */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">Community Health Worker *</label>
                <select
                  value={selectedChwId}
                  onChange={(e) => setSelectedChwId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Select Community Health Worker</option>
                  {chws.map((chw) => (
                    <option key={chw.id} value={chw.id}>
                      {chw.fullname} (ID: {chw.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Visit Date */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">Visit Date *</label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Visit Reason */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold">Reason for Visit</label>
                <textarea
                  rows={3}
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-sm text-slate-100 placeholder-slate-650 outline-none focus:border-emerald-500 transition-colors resize-none"
                  placeholder="Reason for visit..."
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsScheduleVisitModalOpen(false); setSelectedAlertForVisit(null); }}
                className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              {selectedChwId && (
                <button
                  type="button"
                  onClick={submitScheduleHomeVisit}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all"
                >
                  Schedule
                </button>
              )}
            </div>

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
                  : toast.type === 'compliance_alert'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
            }`}>
              {toast.type === 'message' ? (
                <MessageSquare className="h-4 w-4" />
              ) : toast.type === 'referral' ? (
                <Activity className="h-4 w-4" />
              ) : toast.type === 'compliance_alert' ? (
                <AlertTriangle className="h-4 w-4" />
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
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm font-bold align-top leading-none"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default Dashboard;

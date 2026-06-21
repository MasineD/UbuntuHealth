import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import routes
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import chwsRoutes from './routes/chws.js';
import staffRoutes from './routes/staff.js';
import referralsRoutes from './routes/referrals.js';
import appointmentsRoutes from './routes/appointments.js';
import chatRoutes from './routes/chat.js';
import dotenv from 'dotenv';
import pool from './config/database.js';
import { sendSMS, sendSMSNotification } from './utils/sms.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "https://ubuntu-health.onrender.com"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set('socketio', io);

// ========== EXISTING MIDDLEWARE ==========
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ========== EXISTING ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/auth', patientsRoutes);
app.use('/api/auth', chwsRoutes);
app.use('/api/auth', staffRoutes);
app.use('/api/auth', referralsRoutes);
app.use('/api/auth', appointmentsRoutes);
app.use('/api/auth', chatRoutes);

// ========== SOCKET.IO CODE ==========
io.on('connection', (socket) => {
  console.log('New Socket.io client connected:', socket.id);

  socket.on('register-user', (data) => {
    const { userId, role, organization, staffRole } = data;
    if (!userId || !role || !organization) {
      console.log('Registration data incomplete:', data);
      return;
    }

    console.log(`Socket register-user: user=${userId}, role=${role}, org=${organization}, staffRole=${staffRole}`);

    // Join organization room
    socket.join(`org_${organization}`);

    // Join individual user room
    socket.join(`org_${organization}_user_${role}_${userId}`);

    // Join role-specific room
    if (role === 'staff') {
      const normalizedStaffRole = staffRole ? staffRole.toLowerCase().replace('/', '_').replace(' ', '_') : 'doctor_nurse';
      socket.join(`org_${organization}_role_${normalizedStaffRole}`);
      socket.join(`org_${organization}_staff`);
    } else if (role === 'chw') {
      socket.join(`org_${organization}_role_chw`);
      socket.join(`org_${organization}_staff`);
    } else if (role === 'admin') {
      socket.join(`org_${organization}_role_admin`);
      socket.join(`org_${organization}_staff`);
    } else if (role === 'patient') {
      socket.join(`org_${organization}_role_patient`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket.io client disconnected:', socket.id);
  });
});
// ========== END OF SOCKET.IO CODE ==========

// ========== BACKGROUND COMPLIANCE HELPER ==========
async function autoScheduleHomeVisit(alertId, patientId, orgName, reason) {
  try {
    // 1. Find a CHW in the same organization
    const chwRes = await pool.query(
      `SELECT chw.id, chw.fullname, chw.phone_number 
       FROM users.comm_health_workers chw
       JOIN users.admins a ON chw.registra_id = a.id
       WHERE a.organization = $1
       ORDER BY chw.id ASC
       LIMIT 1`,
      [orgName]
    );

    if (chwRes.rows.length === 0) {
      console.log(`No CHW found in organization "${orgName}" to auto-schedule home visit.`);
      return;
    }

    const chw = chwRes.rows[0];
    const chwId = chw.id;

    // 2. Set visit date to the next day of the current day
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const visitDateStr = nextDay.toISOString().split('T')[0];

    // 3. Update the compliance alert in the database
    await pool.query(
      `UPDATE patients.compliance_alerts 
       SET visit_scheduled = true, 
           chw_id = $1, 
           visit_reason = $2, 
           visit_date = $3, 
           visit_status = 'pending' 
       WHERE id = $4`,
      [chwId, reason, visitDateStr, alertId]
    );

    console.log(`Auto-scheduled home visit for alert ${alertId} to CHW ${chw.fullname} on ${visitDateStr}. Reason: ${reason}`);

    // 4. Send notifications
    // Query patient details to send in notifications
    const patientRes = await pool.query(
      `SELECT p.id, p.fullname, p.id_number, p.phone_number, p.gender, p.house_number, p.surbub, p.city 
       FROM users.patients p WHERE p.id = $1`,
      [patientId]
    );
    const patient = patientRes.rows[0] || {};

    // Notify CHW
    const chwNotification = {
      type: 'home_visit',
      title: 'New Home Visit Assigned',
      message: `You have been automatically assigned a home visit for patient "${patient.fullname}" on ${visitDateStr}. Reason: ${reason}`,
      timestamp: new Date().toISOString(),
      visit: {
        id: alertId,
        reason: reason,
        visit_date: visitDateStr,
        patient: {
          id: patient.id,
          fullname: patient.fullname,
          id_number: patient.id_number,
          phone_number: patient.phone_number,
          gender: patient.gender,
          address: `${patient.house_number || ''} ${patient.surbub || ''}, ${patient.city || ''}`.trim()
        }
      }
    };
    io.to(`org_${orgName}_user_chw_${chwId}`).emit('new-notification', chwNotification);
    await sendSMSNotification('chw', chwId, chwNotification.message);

    // Notify Patient
    const patientNotification = {
      type: 'home_visit_scheduled',
      title: 'Home Visit Scheduled',
      message: `A home visit has been scheduled for you on ${visitDateStr}. Reason: ${reason}`,
      timestamp: new Date().toISOString()
    };
    io.to(`org_${orgName}_user_patient_${patient.id}`).emit('new-notification', patientNotification);
    await sendSMSNotification('patient', patient.id, patientNotification.message);
  } catch (err) {
    console.error('Error in autoScheduleHomeVisit:', err.message);
  }
}

// ========== BACKGROUND MEDICATION CHECKER ==========
const startMedicationChecker = () => {
  setInterval(async () => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      // 1. MEDICATION SLOTS EMISSION (Only run at the start of each minute to prevent duplicate checks)
      if (now.getSeconds() < 15) {
        // Query patients on treatment who have a matching medication time today
        const patientsRes = await pool.query(
          `SELECT p.id, p.fullname, p.phone_number, a.organization, hr.morning_time, hr.midday_time, hr.evening_time
           FROM users.patients p
           JOIN users.admins a ON p.registra_id = a.id
           JOIN patients.health_records hr ON p.id = hr.patient_id
           WHERE hr.on_treatment = true AND (
             (hr.morning_time IS NOT NULL AND SUBSTRING(hr.morning_time::text, 1, 5) = $1) OR
             (hr.midday_time IS NOT NULL AND SUBSTRING(hr.midday_time::text, 1, 5) = $1) OR
             (hr.evening_time IS NOT NULL AND SUBSTRING(hr.evening_time::text, 1, 5) = $1)
           )`,
          [currentTimeStr]
        );

        for (const row of patientsRes.rows) {
          const patientId = row.id;
          const org = row.organization;
          
          let slots = [];
          if (row.morning_time && row.morning_time.substring(0, 5) === currentTimeStr) slots.push({ type: 'morning', time: row.morning_time });
          if (row.midday_time && row.midday_time.substring(0, 5) === currentTimeStr) slots.push({ type: 'midday', time: row.midday_time });
          if (row.evening_time && row.evening_time.substring(0, 5) === currentTimeStr) slots.push({ type: 'evening', time: row.evening_time });

          for (const slot of slots) {
            const insertRes = await pool.query(
              `INSERT INTO patients.medication_logs (patient_id, medication_time, scheduled_time, date)
               VALUES ($1, $2, $3, CURRENT_DATE)
               ON CONFLICT (patient_id, medication_time, date) DO NOTHING
               RETURNING id`,
              [patientId, slot.type, slot.time]
            );

            if (insertRes.rows.length > 0) {
              console.log(`Sending medication notification to patient ${patientId} for ${slot.type} slot.`);
              const notificationData = {
                type: 'medication',
                title: 'Take Medication',
                message: `It is time to take your ${slot.type} medication scheduled for ${slot.time.substring(0, 5)}.`,
                timestamp: new Date().toISOString()
              };
              io.to(`org_${org}_user_patient_${patientId}`).emit('new-notification', notificationData);
              if (row.phone_number) {
                await sendSMS(row.phone_number, notificationData.message);
              }
            }
          }
        }
      }

      // 2. COMPLIANCE CHECKER FOR ADMINS (Evaluated every 15 seconds)
      const allTreatmentRes = await pool.query(
        `SELECT p.id, p.fullname, p.id_number, p.gender, p.email, p.phone_number,
                p.house_number, p.surbub, p.city, p.next_of_kin_fullname, p.next_of_kin_phone,
                a.organization, hr.morning_time::text, hr.midday_time::text, hr.evening_time::text
         FROM users.patients p
         JOIN users.admins a ON p.registra_id = a.id
         JOIN patients.health_records hr ON p.id = hr.patient_id
         WHERE hr.on_treatment = true`
      );

      for (const row of allTreatmentRes.rows) {
        const patientId = row.id;
        const org = row.organization;
        const times = [row.morning_time, row.midday_time, row.evening_time].filter(Boolean);
        if (times.length === 0) continue;

        // Sort times descending to find the last time of the day
        times.sort((a, b) => b.localeCompare(a));
        const lastTime = times[0];

        // Construct last medication time today
        const [h, m, s] = lastTime.split(':').map(Number);
        const targetTime = new Date();
        targetTime.setHours(h, m, s || 0, 0);

        // Compliance trigger time is 15 seconds after the last medication time of the day
        const triggerTime = new Date(targetTime.getTime() + 15 * 1000);

        if (now >= triggerTime && now.getDate() === targetTime.getDate()) {
          // Check if already logged a compliance alert today
          const alertRes = await pool.query(
            'SELECT 1 FROM patients.compliance_alerts WHERE patient_id = $1 AND date = CURRENT_DATE AND routine_id = -1',
            [patientId]
          );

          if (alertRes.rows.length === 0) {
            // Check completed medication tasks today
            const expectedCount = times.length;
            const takenRes = await pool.query(
              'SELECT count(*) as taken_count FROM patients.medication_logs WHERE patient_id = $1 AND date = CURRENT_DATE AND taken = true',
              [patientId]
            );
            const takenCount = Number(takenRes.rows[0].taken_count);

            if (takenCount < expectedCount) {
              // Missed at least one medication task! Log the compliance alert
              const insertAlert = await pool.query(
                `INSERT INTO patients.compliance_alerts (patient_id, date, routine_id, alert_type) 
                 VALUES ($1, CURRENT_DATE, -1, 'medication')
                 ON CONFLICT (patient_id, date, routine_id) DO NOTHING 
                 RETURNING id`,
                [patientId]
              );

              if (insertAlert.rows.length > 0) {
                console.log(`Compliance failure detected for patient ${row.fullname}. Alerting admin.`);
                const alertId = insertAlert.rows[0].id;
                await autoScheduleHomeVisit(alertId, patientId, org, 'Medication Non-Compliance Follow-up');

                const alertPayload = {
                  type: 'compliance_alert',
                  title: 'Patient Non-Compliance',
                  message: `Patient "${row.fullname}" did not take medication.`,
                  timestamp: new Date().toISOString(),
                  patient: {
                    id: row.id,
                    fullname: row.fullname,
                    id_number: row.id_number,
                    gender: row.gender,
                    email: row.email,
                    phone_number: row.phone_number,
                    house_number: row.house_number,
                    surbub: row.surbub,
                    city: row.city,
                    next_of_kin_fullname: row.next_of_kin_fullname,
                    next_of_kin_phone: row.next_of_kin_phone
                  }
                };
                io.to(`org_${org}_role_admin`).emit('new-notification', alertPayload);
                await sendSMSNotification('admin', org, alertPayload.message);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in medication checker interval:', err.message);
    }
  }, 15000); // Check every 15 seconds
};

startMedicationChecker();

// ========== BACKGROUND ROUTINE CHECKER ==========
const sentPatientRoutineNotifications = new Set(); // Set of "YYYY-MM-DD:routine_id"

const startRoutineChecker = () => {
  setInterval(async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentWeekday = now.toLocaleDateString('en-US', { weekday: 'long' });
      const currentDayOfMonth = now.getDate();

      const routinesRes = await pool.query(`
        SELECT r.id, r.record_id, r.weekly, r.monthly, r.weekday, r.day_of_month, r.time, r.description, r.status,
               hr.patient_id, p.fullname AS patient_name, p.id_number, p.gender, p.email, p.phone_number,
               p.house_number, p.surbub, p.city, p.next_of_kin_fullname, p.next_of_kin_phone,
               a.organization, a.id as admin_id
        FROM patients.routines r
        JOIN patients.health_records hr ON r.record_id = hr.id
        JOIN users.patients p ON hr.patient_id = p.id
        JOIN users.admins a ON p.registra_id = a.id
      `);

      for (const routine of routinesRes.rows) {
        let isScheduledToday = false;
        if (routine.weekly) {
          if (routine.weekday && routine.weekday.toLowerCase() === currentWeekday.toLowerCase()) {
            isScheduledToday = true;
          }
        } else if (routine.monthly) {
          if (routine.day_of_month === currentDayOfMonth) {
            isScheduledToday = true;
          }
        } else {
          isScheduledToday = true;
        }

        if (!isScheduledToday) continue;

        const desc = (routine.description || '').toLowerCase().trim();
        const isTargetRoutine = 
          desc.includes('doctor visit') || 
          desc.includes('checkup') || 
          desc.includes('refill') || 
          desc === 'doctor visit/ checkup' || 
          desc === 'doctor visit/checkup' || 
          desc === 'doctor visit / checkup' || 
          desc === 'medicine refill';

        if (!isTargetRoutine) continue;

        if (!routine.time) continue;
        const [h, m, s] = routine.time.split(':').map(Number);
        const routineTime = new Date(now.getTime());
        routineTime.setHours(h, m, s || 0, 0);

        const patientNotifyTime = new Date(routineTime.getTime() - 30 * 1000);
        const adminNotifyTime = new Date(routineTime.getTime() + 30 * 1000);

        // a. Patient notification: 30 seconds before routine time
        if (now >= patientNotifyTime && now < routineTime) {
          const key = `${todayStr}:${routine.id}`;
          if (!sentPatientRoutineNotifications.has(key)) {
            console.log(`Sending routine notification to patient ${routine.patient_id} for routine ${routine.id}.`);
            const notificationData = {
              type: 'routine',
              title: 'Upcoming Routine Task',
              message: `Reminder: You have a scheduled "${routine.description}" at ${routine.time.substring(0, 5)} today.`,
              timestamp: new Date().toISOString()
             };
            io.to(`org_${routine.organization}_user_patient_${routine.patient_id}`).emit('new-notification', notificationData);
            await sendSMSNotification('patient', routine.patient_id, notificationData.message);
            sentPatientRoutineNotifications.add(key);
          }
        }

        // b. Admin notification & compliance card: 30 seconds after routine time if not marked as attended
        if (now >= adminNotifyTime) {
          if (!routine.status) {
            const alertRes = await pool.query(
              `SELECT 1 FROM patients.compliance_alerts 
               WHERE patient_id = $1 AND date = $2 AND routine_id = $3`,
              [routine.patient_id, todayStr, routine.id]
            );

            if (alertRes.rows.length === 0) {
              const insertAlert = await pool.query(
                `INSERT INTO patients.compliance_alerts (patient_id, date, routine_id, alert_type, visit_reason)
                 VALUES ($1, $2, $3, 'routine', $4)
                 ON CONFLICT (patient_id, date, routine_id) DO NOTHING
                 RETURNING id`,
                [
                  routine.patient_id,
                  todayStr,
                  routine.id,
                  `Routine Task Non-Compliance Follow-up: ${routine.description}`
                ]
              );

              if (insertAlert.rows.length > 0) {
                console.log(`Compliance failure detected for routine ${routine.id} (patient: ${routine.patient_name}). Alerting admin.`);
                const alertId = insertAlert.rows[0].id;
                await autoScheduleHomeVisit(alertId, routine.patient_id, routine.organization, `Routine Task Non-Compliance Follow-up: ${routine.description}`);

                const alertPayload = {
                  type: 'compliance_alert',
                  title: 'Patient Routine Non-Compliance',
                  message: `Patient "${routine.patient_name}" did not attend scheduled routine "${routine.description}" at ${routine.time.substring(0, 5)}.`,
                  timestamp: new Date().toISOString(),
                  patient: {
                    id: routine.patient_id,
                    fullname: routine.patient_name,
                    id_number: routine.id_number,
                    gender: routine.gender,
                    email: routine.email,
                    phone_number: routine.phone_number,
                    house_number: routine.house_number,
                    surbub: routine.surbub,
                    city: routine.city,
                    next_of_kin_fullname: routine.next_of_kin_fullname,
                    next_of_kin_phone: routine.next_of_kin_phone
                  }
                };
                io.to(`org_${routine.organization}_role_admin`).emit('new-notification', alertPayload);
                await sendSMSNotification('admin', routine.organization, alertPayload.message);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in routine checker interval:', err.message);
    }
  }, 5000); // Check every 5 seconds
};

startRoutineChecker();
// ========== END OF BACKGROUND CHECKER ==========

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

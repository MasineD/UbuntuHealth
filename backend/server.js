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

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
  "http://127.0.0.1:5173"
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

// ========== BACKGROUND MEDICATION CHECKER ==========
const startMedicationChecker = () => {
  setInterval(async () => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      // Query patients on treatment who have a matching medication time today
      const patientsRes = await pool.query(
        `SELECT p.id, p.fullname, a.organization, hr.morning_time, hr.midday_time, hr.evening_time
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
          }
        }
      }
    } catch (err) {
      console.error('Error in medication checker interval:', err.message);
    }
  }, 60000); // Check every minute
};

startMedicationChecker();
// ========== END OF BACKGROUND CHECKER ==========

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
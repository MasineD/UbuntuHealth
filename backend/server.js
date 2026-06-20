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

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
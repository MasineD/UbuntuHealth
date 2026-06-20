import express from 'express';
// import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import your existing routes
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import chwsRoutes from './routes/chws.js';
import staffRoutes from './routes/staff.js';
import referralsRoutes from './routes/referrals.js';
import appointmentsRoutes from './routes/appointments.js';
import dotenv from 'dotenv'

dotenv.config()

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5174"
];

// const io = new Server(server, {
//   cors: {
//     origin: allowedOrigins,
//     credentials: true,
//   },
// });

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

// ========== SOCKET.IO CODE (ADD THIS) ==========
// Store online users and their socket IDs
// const onlineUsers = new Map(); // userId -> socketId

// io.on('connection', (socket) => {
//   console.log('New client connected:', socket.id);

//   // Register user with their userId
//   socket.on('register-user', (userId) => {
//     onlineUsers.set(userId, socket.id);
//     console.log(`User ${userId} registered with socket ${socket.id}`);
//   });

//   // Handle comment notifications
//   socket.on('send-comment', (data) => {
//     const { projectOwnerId, projectTitle, commenterName, commenterEmail, commentText, projectId } = data;
    
//     const ownerSocketId = onlineUsers.get(projectOwnerId);
    
//     if (ownerSocketId) {
//       io.to(ownerSocketId).emit('new-notification', {
//         type: 'comment',
//         title: 'New Comment',
//         message: `${commenterName} <${commenterEmail}> commented on your project "${projectTitle}": "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
//         projectId: projectId,
//         projectTitle: projectTitle,
//         timestamp: new Date().toISOString()
//       });
//       console.log(`Comment notification sent to user ${projectOwnerId}`);
//     }
//   });

//   // Handle raise hand / collaboration request
//   socket.on('raise-hand', (data) => {
//     const { projectOwnerId, projectTitle, requesterName, requesterEmail, projectId } = data;
    
//     const ownerSocketId = onlineUsers.get(projectOwnerId);
    
//     if (ownerSocketId) {
//       io.to(ownerSocketId).emit('new-notification', {
//         type: 'collaboration',
//         title: 'Collaboration Request',
//         message: `${requesterName}<${requesterEmail}> is interested in collaborating on your project "${projectTitle}"`,
//         projectId: projectId,
//         projectTitle: projectTitle,
//         requesterName: requesterName,
//         timestamp: new Date().toISOString()
//       });
//       console.log(`Collaboration request sent to user ${projectOwnerId}`);
//     }
//   });

//   // Handle mark as read
//   socket.on('mark-read', (notificationId) => {
//     console.log(`Notification ${notificationId} marked as read`);
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     for (const [userId, socketId] of onlineUsers.entries()) {
//       if (socketId === socket.id) {
//         onlineUsers.delete(userId);
//         console.log(`User ${userId} disconnected`);
//         break;
//       }
//     }
//   });
// });
// ========== END OF SOCKET.IO CODE ==========

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
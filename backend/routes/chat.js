import express from 'express';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Helper function to resolve any user's organization
async function getUserOrganization(userId, role) {
    if (role === 'admin') {
        const res = await pool.query('SELECT organization FROM users.admins WHERE id = $1', [userId]);
        return res.rows[0]?.organization || null;
    }
    if (role === 'patient') {
        const res = await pool.query(
            'SELECT a.organization FROM users.patients p JOIN users.admins a ON p.registra_id = a.id WHERE p.id = $1',
            [userId]
        );
        return res.rows[0]?.organization || null;
    }
    if (role === 'chw') {
        const res = await pool.query(
            'SELECT a.organization FROM users.comm_health_workers chw JOIN users.admins a ON chw.registra_id = a.id WHERE chw.id = $1',
            [userId]
        );
        return res.rows[0]?.organization || null;
    }
    if (role === 'staff') {
        const res = await pool.query(
            'SELECT a.organization FROM users.clinical_staff cs JOIN users.admins a ON cs.registra_id = a.id WHERE cs.id = $1',
            [userId]
        );
        return res.rows[0]?.organization || null;
    }
    return null;
}

// GET /chat/users: Get all users in the same organization
router.get('/chat/users', protect, async (req, res) => {
    try {
        const orgName = await getUserOrganization(req.user.id, req.user.role);
        if (!orgName) {
            return res.status(400).json({ message: 'User organization could not be resolved' });
        }

        // Fetch admins
        const adminsRes = await pool.query(
            `SELECT id, fullname, 'admin' as role, NULL as staff_role 
             FROM users.admins 
             WHERE organization = $1`,
            [orgName]
        );

        // Fetch clinical staff
        const staffRes = await pool.query(
            `SELECT cs.id, cs.fullname, 'staff' as role, cs.role as staff_role 
             FROM users.clinical_staff cs 
             JOIN users.admins a ON cs.registra_id = a.id 
             WHERE a.organization = $1`,
            [orgName]
        );

        // Fetch CHWs
        const chwsRes = await pool.query(
            `SELECT chw.id, chw.fullname, 'chw' as role, NULL as staff_role 
             FROM users.comm_health_workers chw 
             JOIN users.admins a ON chw.registra_id = a.id 
             WHERE a.organization = $1`,
            [orgName]
        );

        // Fetch patients
        const patientsRes = await pool.query(
            `SELECT p.id, p.fullname, 'patient' as role
             FROM users.patients p 
             JOIN users.admins a ON p.registra_id = a.id 
             WHERE a.organization = $1`,
            [orgName]
        );

        // Combine lists
        const allUsers = [
            ...adminsRes.rows,
            ...staffRes.rows,
            ...chwsRes.rows,
            ...patientsRes.rows
        ];

        // Filter out the current requester
        const filteredUsers = allUsers.filter(u => 
            !(u.id.toString() === req.user.id.toString() && u.role === req.user.role)
        );

        return res.json({ users: filteredUsers });
    } catch (error) {
        console.error('Error fetching chat users:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// GET /chat/messages: Get all messages visible to current user
router.get('/chat/messages', protect, async (req, res) => {
    try {
        const orgName = await getUserOrganization(req.user.id, req.user.role);
        if (!orgName) {
            return res.status(400).json({ message: 'User organization could not be resolved' });
        }

        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;
        const staffRole = req.user.staff_role || null;

        const result = await pool.query(
            `SELECT DISTINCT m.*
             FROM tasks.chat_messages m
             WHERE m.organization = $1 AND (
                 -- Sent by the current user
                 (m.sender_id = $2 AND m.sender_role = $3)
                 -- Or sent individually to the current user
                 OR (m.recipient_type = 'individual' AND m.recipient_id = $2 AND m.recipient_role = $3)
                 -- Or group messages targeting the current user's role
                 OR (m.recipient_type = 'all_staff' AND $3 IN ('admin', 'staff', 'chw'))
                 OR (m.recipient_type = 'social_worker' AND ($3 = 'admin' OR ($3 = 'staff' AND $4 = 'social worker')))
                 OR (m.recipient_type = 'therapist' AND ($3 = 'admin' OR ($3 = 'staff' AND $4 = 'therapist')))
                 OR (m.recipient_type = 'chw' AND ($3 = 'admin' OR $3 = 'chw'))
                 OR (m.recipient_type = 'patient' AND ($3 = 'admin' OR $3 = 'patient'))
                 OR (m.recipient_type = 'doctor_nurse' AND ($3 = 'admin' OR ($3 = 'staff' AND $4 = 'doctor/nurse')))
             )
             ORDER BY m.created_at ASC`,
            [orgName, currentUserId, currentUserRole, staffRole]
        );

        return res.json({ messages: result.rows });
    } catch (error) {
        console.error('Error fetching chat messages:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// POST /chat/messages: Send a new message
router.post('/chat/messages', protect, async (req, res) => {
    const { recipient_type, recipient_id, recipient_role, message_text } = req.body;

    if (!recipient_type || !message_text) {
        return res.status(400).json({ message: 'Please provide recipient_type and message_text' });
    }

    try {
        const orgName = await getUserOrganization(req.user.id, req.user.role);
        if (!orgName) {
            return res.status(400).json({ message: 'User organization could not be resolved' });
        }

        const result = await pool.query(
            `INSERT INTO tasks.chat_messages (
                sender_id, sender_role, sender_name, organization, recipient_type, recipient_id, recipient_role, message_text
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                req.user.id,
                req.user.role,
                req.user.fullname || req.user.name,
                orgName,
                recipient_type,
                recipient_id || null,
                recipient_role || null,
                message_text
            ]
        );

        const savedMsg = result.rows[0];
        const io = req.app.get('socketio');

        if (io) {
            const sndRoom = `org_${orgName}_user_${savedMsg.sender_role}_${savedMsg.sender_id}`;
            if (savedMsg.recipient_type === 'individual') {
                const recRoom = `org_${orgName}_user_${savedMsg.recipient_role}_${savedMsg.recipient_id}`;
                
                io.to(recRoom).to(sndRoom).emit('new-message', savedMsg);
            } else {
                const adminRoom = `org_${orgName}_role_admin`;
                let targetRoom = null;
                
                if (savedMsg.recipient_type === 'all_staff') {
                    targetRoom = `org_${orgName}_staff`;
                } else {
                    targetRoom = `org_${orgName}_role_${savedMsg.recipient_type}`;
                }
                
                if (targetRoom) {
                    io.to(targetRoom).to(adminRoom).to(sndRoom).emit('new-message', savedMsg);
                } else {
                    io.to(adminRoom).to(sndRoom).emit('new-message', savedMsg);
                }
            }
        }

        return res.status(201).json({ message: 'Message sent successfully', chatMessage: savedMsg });
    } catch (error) {
        console.error('Error sending chat message:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

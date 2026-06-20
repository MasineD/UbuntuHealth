import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Create new appointment (Public - supports anonymous and logged-in patients)
router.post('/appointments', async (req, res) => {
    const { 
        fullname, 
        organization_to, 
        department_to, 
        staff_to, 
        reason, 
        arrival_date, 
        arrival_time,
        phone_number 
    } = req.body;

    if (!organization_to || !department_to || !reason || !arrival_date) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        let patientId = null;
        let finalFullname = fullname;
        let finalPhone = phone_number;

        // Try to identify if a registered patient is logged in
        const token = req.cookies.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.role === 'patient') {
                    const result = await pool.query('SELECT id, fullname, phone_number FROM users.patients WHERE id = $1', [decoded.id]);
                    if (result.rows.length > 0) {
                        patientId = result.rows[0].id;
                        finalFullname = result.rows[0].fullname; // prefill from DB
                        finalPhone = result.rows[0].phone_number;
                    }
                }
            } catch (err) {
                // Token invalid, ignore and process as anonymous booking
            }
        }

        // If not logged-in patient, fullname is required from body
        if (!patientId && !finalFullname) {
            return res.status(400).json({ message: 'Full name is required for booking' });
        }

        // Enforce: An appointment cannot be made to a CHW
        if (staff_to) {
            const isChw = await pool.query(
                'SELECT id FROM users.comm_health_workers WHERE employee_id = $1', 
                [staff_to]
            );
            if (isChw.rows.length > 0) {
                return res.status(400).json({ message: 'An appointment cannot be scheduled with a community health worker' });
            }
        }

        const newApp = await pool.query(
            `INSERT INTO tasks.appointments (
                fullname, organization_to, department_to, staff_to, reason, arrival_date, arrival_time, phone_number, status, patient_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [
                finalFullname,
                organization_to,
                department_to,
                staff_to || null,
                reason,
                arrival_date,
                arrival_time || null,
                finalPhone || null,
                'pending approval',
                patientId
            ]
        );

        return res.status(201).json({ message: 'Appointment requested successfully', appointment: newApp.rows[0] });
    } catch (error) {
        console.error('Error creating appointment:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get appointments (Authenticated only, filters by role)
router.get('/appointments', protect, async (req, res) => {
    try {
        let appointments = [];
        const currentUserIdStr = req.user.id.toString();

        if (req.user.role === 'admin') {
            // Admin sees all appointments to their organization, marked with is_our_patient
            const result = await pool.query(
                `SELECT app.*, 
                        (p.id IS NOT NULL AND a.organization = app.organization_to) AS is_our_patient
                 FROM tasks.appointments app
                 LEFT JOIN users.patients p ON app.patient_id = p.id
                 LEFT JOIN users.admins a ON p.registra_id = a.id
                 WHERE app.organization_to = $1
                 ORDER BY app.id DESC`,
                [req.user.organization]
            );
            appointments = result.rows;
        } else if (req.user.role === 'staff') {
            // Staff member sees only appointments made directly to them
            const result = await pool.query(
                `SELECT * FROM tasks.appointments 
                 WHERE (staff_to = $1 OR staff_to = $2 OR staff_to = $3) AND organization_to = (
                     SELECT a.organization 
                     FROM users.clinical_staff cs
                     JOIN users.admins a ON cs.registra_id = a.id
                     WHERE cs.id = $4
                 )
                 ORDER BY id DESC`,
                [currentUserIdStr, req.user.fullname, req.user.employee_id, req.user.id]
            );
            appointments = result.rows;
        } else if (req.user.role === 'patient') {
            // Patient sees only appointments they requested
            const result = await pool.query(
                `SELECT * FROM tasks.appointments 
                 WHERE patient_id = $1
                 ORDER BY id DESC`,
                [req.user.id]
            );
            appointments = result.rows;
        }

        return res.json({ appointments });
    } catch (error) {
        console.error('Error fetching appointments:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Update appointment status (Authenticated only)
router.put('/appointments/:id/status', protect, async (req, res) => {
    const { status } = req.body;
    const appointmentId = req.params.id;

    if (!['approved', 'rejected', 'attended'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status type' });
    }

    try {
        const appRes = await pool.query('SELECT * FROM tasks.appointments WHERE id = $1', [appointmentId]);
        if (appRes.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        const appointment = appRes.rows[0];

        // Authorization check
        let isAuthorized = false;

        if (appointment.staff_to) {
            // Made to a specific staff member
            if (req.user.role === 'staff') {
                const currentUserIdStr = req.user.id.toString();
                if (
                    appointment.staff_to === currentUserIdStr || 
                    appointment.staff_to === req.user.fullname || 
                    appointment.staff_to === req.user.employee_id
                ) {
                    isAuthorized = true;
                }
            }
        } else {
            // Defaults to organization's admin
            if (req.user.role === 'admin' && req.user.organization === appointment.organization_to) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to change status. Only the designated recipient can approve, reject, or mark it as attended.' });
        }

        await pool.query('UPDATE tasks.appointments SET status = $1 WHERE id = $2', [status, appointmentId]);

        const io = req.app.get('socketio');
        if (io) {
            const org = appointment.organization_to;
            const notificationData = {
                type: 'appointment_status',
                title: 'Appointment Status Updated',
                message: `Appointment #${appointmentId} status for ${appointment.fullname} has been updated to "${status}"`,
                appointmentId,
                status,
                timestamp: new Date().toISOString()
            };

            // Notify patient if registered
            if (appointment.patient_id) {
                io.to(`org_${org}_user_patient_${appointment.patient_id}`).emit('new-notification', notificationData);
            }

            // Notify clinician if assigned
            if (appointment.staff_to) {
                const staffRes = await pool.query(
                    'SELECT id FROM users.clinical_staff WHERE fullname = $1 OR employee_id = $1 OR id::text = $1',
                    [appointment.staff_to]
                );
                if (staffRes.rows.length > 0) {
                    io.to(`org_${org}_user_staff_${staffRes.rows[0].id}`).emit('new-notification', notificationData);
                }
            }

            // Notify admin
            io.to(`org_${org}_role_admin`).emit('new-notification', notificationData);
        }

        return res.json({ message: `Appointment status updated to ${status}` });
    } catch (error) {
        console.error('Error updating appointment status:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

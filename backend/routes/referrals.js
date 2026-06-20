import express from 'express';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Get all registered organizations
router.get('/organizations', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT organization 
             FROM users.admins 
             WHERE organization IS NOT NULL AND organization != ''
             ORDER BY organization ASC`
        );
        const orgs = result.rows.map(r => r.organization);
        return res.json({ organizations: orgs });
    } catch (error) {
        console.error('Error fetching organizations:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get clinical staff members of a specific organization (excluding CHWs)
router.get('/organizations/:orgName/staff', async (req, res) => {
    const { orgName } = req.params;
    try {
        const result = await pool.query(
            `SELECT cs.id, cs.fullname, cs.employee_id, cs.role as staff_role
             FROM users.clinical_staff cs
             JOIN users.admins a ON cs.registra_id = a.id
             WHERE a.organization = $1
             ORDER BY cs.fullname ASC`,
            [orgName]
        );
        return res.json({ staff: result.rows });
    } catch (error) {
        console.error('Error fetching organization staff:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Create a new referral
router.post('/referrals', protect, async (req, res) => {
    const { 
        personel, 
        organization_to, 
        department_to, 
        staff_to, 
        reason, 
        arrival_date, 
        arrival_time 
    } = req.body;

    if (!personel || !organization_to || !department_to || !reason || !arrival_date) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // Enforce CHW constraints: A CHW can only make referrals to the organization they are registered under.
        if (req.user.role === 'chw') {
            const result = await pool.query(
                `SELECT a.organization 
                 FROM users.comm_health_workers chw 
                 JOIN users.admins a ON chw.registra_id = a.id 
                 WHERE chw.id = $1`,
                [req.user.id]
            );
            if (result.rows.length === 0 || result.rows[0].organization !== organization_to) {
                return res.status(403).json({ message: 'A community health worker can only make a referral to the organization they are registered under' });
            }
        }

        // Enforce: A referral cannot be made to a CHW.
        if (staff_to) {
            const isChw = await pool.query('SELECT * FROM users.comm_health_workers WHERE employee_id = $1', [staff_to]);
            if (isChw.rows.length > 0) {
                return res.status(400).json({ message: 'A referral cannot be made to a community health worker' });
            }
        }

        // Creating a new referral
        const referralKey = crypto.randomBytes(4).toString('hex').toUpperCase();

        const newReferral = await pool.query(
            `INSERT INTO tasks.referrals (
                referrer_id, referrer_role, personel, organization_to, department_to, staff_to, reason, arrival_date, arrival_time, status, referral_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *`,
            [
                req.user.id,
                req.user.role,
                personel,
                organization_to,
                department_to,
                staff_to || null,
                reason,
                arrival_date,
                arrival_time || null,
                false,
                referralKey
            ]
        );

        const referral = newReferral.rows[0];
        const io = req.app.get('socketio');

        if (io) {
            const org = organization_to;
            const notificationData = {
                type: 'referral_created',
                title: 'New Referral Created',
                message: `A new referral has been created for patient "${personel}" to ${organization_to} (${department_to})`,
                referralId: referral.id,
                timestamp: new Date().toISOString()
            };

            // Notify patient if registered
            const patientRes = await pool.query('SELECT id FROM users.patients WHERE fullname = $1', [personel]);
            if (patientRes.rows.length > 0) {
                const patientId = patientRes.rows[0].id;
                const patientOrgRes = await pool.query(
                    'SELECT a.organization FROM users.patients p JOIN users.admins a ON p.registra_id = a.id WHERE p.id = $1',
                    [patientId]
                );
                const patientOrg = patientOrgRes.rows[0]?.organization || org;
                io.to(`org_${patientOrg}_user_patient_${patientId}`).emit('new-notification', notificationData);
            }

            // Notify target clinician if assigned
            if (staff_to) {
                const staffRes = await pool.query(
                    'SELECT id FROM users.clinical_staff WHERE fullname = $1 OR employee_id = $1 OR id::text = $1',
                    [staff_to]
                );
                if (staffRes.rows.length > 0) {
                    io.to(`org_${org}_user_staff_${staffRes.rows[0].id}`).emit('new-notification', notificationData);
                }
            }

            // Notify target admin
            io.to(`org_${org}_role_admin`).emit('new-notification', notificationData);
        }

        return res.status(201).json({ message: 'Referral created successfully', referral });
    } catch (error) {
        console.error('Error creating referral:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get referrals grouped by incoming and outgoing
router.get('/referrals', protect, async (req, res) => {
    try {
        let incoming = [];
        let outgoing = [];

        const currentUserIdStr = req.user.id.toString();

        if (req.user.role === 'admin') {
            // Outgoing: referrals made by this admin
            const outgoingRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE referrer_id = $1 AND referrer_role = 'admin'
                 ORDER BY id DESC`,
                [req.user.id]
            );
            outgoing = outgoingRes.rows;

            // Incoming: all referrals made to their organization (even if staff_to is not the admin)
            const incomingRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE organization_to = $1
                 ORDER BY id DESC`,
                [req.user.organization]
            );
            incoming = incomingRes.rows;

        } else if (req.user.role === 'staff') {
            // Outgoing: referrals made by this staff member
            const outgoingRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE referrer_id = $1 AND referrer_role = 'staff'
                 ORDER BY id DESC`,
                [req.user.id]
            );
            outgoing = outgoingRes.rows;

            // Incoming: referrals made to them (where staff_to matches their ID, name, or employee ID)
            const incomingRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE staff_to = $1 OR staff_to = $2 OR staff_to = $3
                 ORDER BY id DESC`,
                [currentUserIdStr, req.user.fullname, req.user.employee_id]
            );
            incoming = incomingRes.rows;

        } else if (req.user.role === 'chw') {
            // Outgoing: referrals made by this CHW
            const outgoingRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE referrer_id = $1 AND referrer_role = 'chw'
                 ORDER BY id DESC`,
                [req.user.id]
            );
            outgoing = outgoingRes.rows;
            // CHWs do not have incoming referrals

        } else if (req.user.role === 'patient') {
            // Patient can see referrals where they are the patient (personel matches ID number or name)
            const referralsRes = await pool.query(
                `SELECT * FROM tasks.referrals 
                 WHERE personel LIKE $1 OR personel LIKE $2
                 ORDER BY id DESC`,
                [`%${req.user.id_number}%`, `%${req.user.fullname}%`]
            );
            incoming = referralsRes.rows; 
        }

        return res.json({ incoming, outgoing });
    } catch (error) {
        console.error('Error fetching referrals:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Update referral status to attended
router.put('/referrals/:id/status', protect, async (req, res) => {
    const referralId = req.params.id;

    try {
        const refRes = await pool.query('SELECT * FROM tasks.referrals WHERE id = $1', [referralId]);
        if (refRes.rows.length === 0) {
            return res.status(404).json({ message: 'Referral not found' });
        }

        const referral = refRes.rows[0];

        // If referral has a referral_key generated, verify it
        if (referral.referral_key) {
            const clientKey = req.body.key || req.body.referral_key;
            if (!clientKey) {
                return res.status(400).json({ message: 'Referral key is required to mark it as attended' });
            }
            if (clientKey.toString().toUpperCase() !== referral.referral_key.toString().toUpperCase()) {
                return res.status(400).json({ message: 'Invalid referral key' });
            }
        }

        // Enforce authorization:
        // Only the person who the referral is made to can change status.
        let isAuthorized = false;

        if (referral.staff_to) {
            // Made to a specific staff member
            if (req.user.staff_role === 'social worker' || req.user.staff_role === 'doctor/nurse' || req.user.staff_role === 'therapist') {
                const currentUserIdStr = req.user.id.toString();
                if (
                    referral.staff_to === currentUserIdStr || 
                    referral.staff_to === req.user.fullname || 
                    referral.staff_to === req.user.employee_id
                ) {
                    isAuthorized = true;
                }
            }
        } else {
            // If staff_to is not selected, the referral goes to the admin of organization_to
            if (req.user.role === 'admin' && req.user.organization === referral.organization_to) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Not authorized to change status of this referral. Only the designated recipient can mark it as attended.' });
        }

        await pool.query('UPDATE tasks.referrals SET status = true WHERE id = $1', [referralId]);
        return res.json({ message: 'Referral status updated to attended' });
    } catch (error) {
        console.error('Error updating referral status:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

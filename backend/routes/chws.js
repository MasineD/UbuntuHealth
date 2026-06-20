import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Register CHW route (Admin only)
router.post('/register-chw', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can register community health workers' });
    }

    const { 
        employee_id,
        fullname, 
        id_number, 
        gender, 
        password, 
        email, 
        phone_number, 
        house_number, 
        surbub, 
        municipality, 
        city 
    } = req.body;

    if (!employee_id || !fullname || !id_number || !gender || !password || !phone_number || !house_number || !surbub || !municipality || !city) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (id_number.length !== 13) {
        return res.status(400).json({ message: 'National ID must be exactly 13 digits' });
    }

    if (phone_number.length !== 10) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    try {
        // Check if CHW already exists with id_number or employee_id
        const chwExists = await pool.query('SELECT * FROM users.comm_health_workers WHERE id_number = $1 OR employee_id = $2', [id_number, employee_id]);
        if (chwExists.rows.length > 0) {
            return res.status(400).json({ message: 'Community health worker with this ID number or Employee ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const registraId = req.user.id;

        const newCHW = await pool.query(
            `INSERT INTO users.comm_health_workers (
                registra_id, employee_id, fullname, id_number, gender, password, email, phone_number, 
                house_number, surbub, municipality, city
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING id, employee_id, fullname, id_number, email`,
            [
                registraId, employee_id, fullname, id_number, gender, hashedPassword, email || null, phone_number,
                house_number, surbub, municipality, city
            ]
        );

        return res.status(201).json({ message: 'Community health worker registered successfully', chw: newCHW.rows[0] });
    } catch (error) {
        console.error('Error registering community health worker:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get CHWs registered in the same organization as the admin
router.get('/chws', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can view community health workers list' });
    }

    try {
        const result = await pool.query(
            `SELECT chw.id, chw.employee_id, chw.fullname, chw.id_number, chw.gender, chw.email, chw.phone_number, 
                    chw.house_number, chw.surbub, chw.municipality, chw.city, chw.registra_id
             FROM users.comm_health_workers chw
             JOIN users.admins a ON chw.registra_id = a.id
             WHERE a.organization = $1
             ORDER BY chw.id DESC`,
            [req.user.organization]
        );
        return res.json({ chws: result.rows });
    } catch (error) {
        console.error('Error fetching community health workers:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get patients registered by the same admin who registered this CHW
router.get('/chw/patients', protect, async (req, res) => {
    if (req.user.role !== 'chw') {
        return res.status(403).json({ message: 'Only community health workers can access this endpoint' });
    }

    try {
        // Find the registra_id of the logged in CHW
        const chwRes = await pool.query('SELECT registra_id FROM users.comm_health_workers WHERE id = $1', [req.user.id]);
        if (chwRes.rows.length === 0) {
            return res.status(404).json({ message: 'CHW details not found' });
        }
        const registraId = chwRes.rows[0].registra_id;

        // Get patients registered by the same admin
        const result = await pool.query(
            `SELECT id, fullname, id_number, gender, email, phone_number, 
                    house_number, surbub, municipality, city
             FROM users.patients 
             WHERE registra_id = $1 
             ORDER BY id DESC`,
            [registraId]
        );
        return res.json({ patients: result.rows });
    } catch (error) {
        console.error('Error fetching CHW patients:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get home visits assigned to the logged-in CHW
router.get('/chw/home-visits', protect, async (req, res) => {
    if (req.user.role !== 'chw') {
        return res.status(403).json({ message: 'Only community health workers can view assigned visits' });
    }
    try {
        const result = await pool.query(
            `SELECT ca.id, ca.date::text, ca.visit_scheduled, ca.visit_status, ca.visit_reason, ca.visit_date::text, ca.patient_id,
                    p.fullname AS patient_name, p.id_number AS patient_id_number,
                    p.gender AS patient_gender, p.email AS patient_email,
                    p.phone_number AS patient_phone, p.house_number, p.surbub, p.city,
                    p.next_of_kin_fullname, p.next_of_kin_phone
             FROM patients.compliance_alerts ca
             JOIN users.patients p ON ca.patient_id = p.id
             WHERE ca.chw_id = $1 AND ca.visit_scheduled = true
             ORDER BY ca.id DESC`,
            [req.user.id]
        );
        
        const visits = result.rows.map(row => ({
            id: row.id,
            patient_id: row.patient_id,
            patient_name: row.patient_name,
            patient_id_number: row.patient_id_number,
            patient_gender: row.patient_gender,
            patient_phone: row.patient_phone,
            patient_email: row.patient_email,
            patient_address: `${row.house_number || ''} ${row.surbub || ''}, ${row.city || ''}`.trim(),
            patient_next_of_kin: row.next_of_kin_fullname,
            patient_next_of_kin_phone: row.next_of_kin_phone,
            reason: row.visit_reason,
            visit_date: row.visit_date,
            status: row.visit_status
        }));
        return res.json({ homeVisits: visits });
    } catch (error) {
        console.error('Error fetching CHW home visits:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Fulfill a home visit
router.post('/chw/home-visits/:id/fulfill', protect, async (req, res) => {
    if (req.user.role !== 'chw') {
        return res.status(403).json({ message: 'Only community health workers can fulfill visits' });
    }
    const visitId = req.params.id;
    const { visitNotes } = req.body;
    try {
        const result = await pool.query(
            `UPDATE patients.compliance_alerts 
             SET visit_status = 'visitted', visit_notes = $1 
             WHERE id = $2 AND chw_id = $3 RETURNING *`,
            [visitNotes || '', visitId, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Assigned home visit not found' });
        }
        
        const alert = result.rows[0];

        // Fetch patient and CHW details
        const patientRes = await pool.query(
            `SELECT fullname FROM users.patients WHERE id = $1`,
            [alert.patient_id]
        );
        const patientName = patientRes.rows[0]?.fullname || 'Patient';

        const chwRes = await pool.query(
            `SELECT fullname FROM users.comm_health_workers WHERE id = $1`,
            [req.user.id]
        );
        const chwName = chwRes.rows[0]?.fullname || 'Community Health Worker';

        // Retrieve org of registering admin
        const orgRes = await pool.query(
            `SELECT a.organization 
             FROM users.comm_health_workers u 
             JOIN users.admins a ON u.registra_id = a.id 
             WHERE u.id = $1`,
            [req.user.id]
        );
        const org = orgRes.rows[0]?.organization;

        const io = req.app.get('socketio');
        if (io && org) {
            const adminNotification = {
                type: 'home_visit_fulfilled',
                title: 'Home Visit Fulfilled',
                message: `Community Health Worker "${chwName}" has fulfilled the home visit for patient "${patientName}". Visit Notes: ${visitNotes}`,
                timestamp: new Date().toISOString(),
                visit: {
                    id: alert.id,
                    patient_id: alert.patient_id,
                    patient_name: patientName,
                    chw_id: req.user.id,
                    chw_name: chwName,
                    visit_status: 'visitted',
                    visit_notes: visitNotes,
                    visit_date: alert.visit_date
                }
            };
            io.to(`org_${org}_role_admin`).emit('new-notification', adminNotification);
        }

        return res.json({ message: 'Home visit marked as fulfilled successfully', visit: alert });
    } catch (error) {
        console.error('Error fulfilling home visit:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

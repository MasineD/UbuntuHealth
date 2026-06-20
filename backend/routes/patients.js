import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Register patient route (Admin only)
router.post('/register-patient', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can register patients' });
    }

    const { 
        fullname, 
        id_number, 
        gender, 
        password, 
        email, 
        phone_number, 
        house_number, 
        surbub, 
        municipality, 
        city, 
        next_of_kin_fullname, 
        next_of_kin_email, 
        next_of_kin_phone 
    } = req.body;

    if (!fullname || !id_number || !gender || !password || !phone_number || !house_number || !surbub || !municipality || !city || !next_of_kin_fullname || !next_of_kin_phone) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        // Check if patient already exists
        const patientExists = await pool.query('SELECT * FROM users.patients WHERE id_number = $1', [id_number]);
        if (patientExists.rows.length > 0) {
            return res.status(400).json({ message: 'Patient with this ID number already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const registraId = req.user.id;

        const newPatient = await pool.query(
            `INSERT INTO users.patients (
                registra_id, fullname, id_number, gender, password, email, phone_number, 
                house_number, surbub, municipality, city, next_of_kin_fullname, 
                next_of_kin_email, next_of_kin_phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING id, fullname, id_number, email`,
            [
                registraId, fullname, id_number, gender, hashedPassword, email || null, phone_number,
                house_number, surbub, municipality, city, next_of_kin_fullname,
                next_of_kin_email || null, next_of_kin_phone]
        );

        const patientId = newPatient.rows[0].id;
        await pool.query(
            'INSERT INTO patients.health_records (patient_id, on_treatment) VALUES ($1, $2)',
            [patientId, false]
        );

        return res.status(201).json({ message: 'Patient registered successfully', patient: newPatient.rows[0] });
    } catch (error) {
        console.error('Error registering patient:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get patients registered by the logged in admin
router.get('/patients', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can view patients list' });
    }

    try {
        const result = await pool.query(
            `SELECT id, fullname, id_number, gender, email, phone_number, 
                    house_number, surbub, municipality, city, next_of_kin_fullname, 
                    next_of_kin_email, next_of_kin_phone
             FROM users.patients 
             WHERE registra_id = $1 
             ORDER BY id DESC`,
            [req.user.id]
        );
        return res.json({ patients: result.rows });
    } catch (error) {
        console.error('Error fetching patients:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get health record for a specific patient (Admin, Clinical Staff, and Patient themselves)
router.get('/patients/:id/health-record', protect, async (req, res) => {
    const patientId = req.params.id;
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && (req.user.role !== 'patient' || req.user.id.toString() !== patientId.toString())) {
        return res.status(403).json({ message: 'Only administrative staff, clinical staff, or the patient themselves can view health records' });
    }
    try {
        // Get or create health record on-demand (to support pre-existing patients without one)
        let recordRes = await pool.query('SELECT * FROM patients.health_records WHERE patient_id = $1', [patientId]);
        
        if (recordRes.rows.length === 0) {
            const newRecord = await pool.query(
                'INSERT INTO patients.health_records (patient_id, on_treatment) VALUES ($1, $2) RETURNING *',
                [patientId, false]
            );
            recordRes = newRecord;
        }

        const record = recordRes.rows[0];

        // Retrieve associated routines
        const routinesRes = await pool.query('SELECT * FROM patients.routines WHERE record_id = $1 ORDER BY id ASC', [record.id]);

        return res.json({
            healthRecord: record,
            routines: routinesRes.rows
        });
    } catch (error) {
        console.error('Error fetching patient health record:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Update health record for a specific patient (Admin and Clinical Staff)
router.put('/patients/:id/health-record', protect, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
        return res.status(403).json({ message: 'Only administrative or clinical staff can update patient health records' });
    }

    const patientId = req.params.id;
    const {
        blood_type,
        blood_pressure,
        weight,
        height,
        sugar_level,
        diagnosis,
        on_treatment,
        morning_time,
        midday_time,
        evening_time,
        admission_date,
        release_date,
        routines
    } = req.body;

    try {
        // Get or create health record ID
        let recordRes = await pool.query('SELECT id FROM patients.health_records WHERE patient_id = $1', [patientId]);
        let recordId;
        if (recordRes.rows.length === 0) {
            const newRecord = await pool.query(
                'INSERT INTO patients.health_records (patient_id, on_treatment) VALUES ($1, $2) RETURNING id',
                [patientId, false]
            );
            recordId = newRecord.rows[0].id;
        } else {
            recordId = recordRes.rows[0].id;
        }

        // Update health record
        await pool.query(
            `UPDATE patients.health_records 
             SET blood_type = $1, 
                 blood_pressure = $2, 
                 weight = $3, 
                 height = $4, 
                 sugar_level = $5, 
                 diagnosis = $6, 
                 on_treatment = $7, 
                 morning_time = $8, 
                 midday_time = $9, 
                 evening_time = $10,
                 admission_date = COALESCE($11, admission_date), 
                 release_date = $12
             WHERE id = $13`,
            [
                blood_type || null,
                blood_pressure !== undefined && blood_pressure !== '' ? blood_pressure : null,
                weight !== undefined && weight !== '' ? weight : null,
                height !== undefined && height !== '' ? height : null,
                sugar_level !== undefined && sugar_level !== '' ? sugar_level : null,
                diagnosis || null,
                on_treatment === true,
                morning_time || null,
                midday_time || null,
                evening_time || null,
                admission_date || null,
                release_date || null,
                recordId
            ]
        );

        // Update routines if provided
        if (routines && Array.isArray(routines)) {
            // Get existing routine IDs
            const existingRoutines = await pool.query('SELECT id FROM patients.routines WHERE record_id = $1', [recordId]);
            const existingIds = existingRoutines.rows.map(r => String(r.id));
            const keepIds = [];

            for (const routine of routines) {
                const {
                    id,
                    weekly,
                    monthly,
                    weekday,
                    day_of_month,
                    time,
                    description,
                    status
                } = routine;

                if (id && existingIds.includes(String(id))) {
                    // Update existing routine
                    await pool.query(
                        `UPDATE patients.routines 
                         SET weekly = $1, 
                             monthly = $2, 
                             weekday = $3, 
                             day_of_month = $4, 
                             time = $5, 
                             description = $6, 
                             status = $7
                         WHERE id = $8 AND record_id = $9`,
                        [
                            weekly === true,
                            monthly === true,
                            weekday || null,
                            day_of_month !== undefined && day_of_month !== '' ? day_of_month : null,
                            time || null,
                            description || null,
                            status === true,
                            id,
                            recordId
                        ]
                    );
                    keepIds.push(String(id));
                } else {
                    // Insert new routine
                    const newRoutine = await pool.query(
                        `INSERT INTO patients.routines (
                            record_id, weekly, monthly, weekday, day_of_month, time, description, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                        [
                            recordId,
                            weekly === true,
                            monthly === true,
                            weekday || null,
                            day_of_month !== undefined && day_of_month !== '' ? day_of_month : null,
                            time || null,
                            description || null,
                            status === true
                        ]
                    );
                    keepIds.push(String(newRoutine.rows[0].id));
                }
            }

            // Delete any routines that are no longer in the list
            const deleteIds = existingIds.filter(id => !keepIds.includes(id));
            if (deleteIds.length > 0) {
                await pool.query('DELETE FROM patients.routines WHERE id = ANY($1::bigint[]) AND record_id = $2', [deleteIds, recordId]);
            }
        }

        return res.json({ message: 'Patient health record and routines updated successfully' });
    } catch (error) {
        console.error('Error updating patient health record:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get all patients registered in the referrer's organization
router.get('/organization-patients', protect, async (req, res) => {
    try {
        let organization;
        if (req.user.role === 'admin') {
            organization = req.user.organization;
        } else if (req.user.role === 'chw') {
            const result = await pool.query(
                `SELECT a.organization 
                 FROM users.comm_health_workers chw 
                 JOIN users.admins a ON chw.registra_id = a.id 
                 WHERE chw.id = $1`,
                [req.user.id]
            );
            if (result.rows.length > 0) {
                organization = result.rows[0].organization;
            }
        } else if (req.user.role === 'staff') {
            const result = await pool.query(
                `SELECT a.organization 
                 FROM users.clinical_staff cs 
                 JOIN users.admins a ON cs.registra_id = a.id 
                 WHERE cs.id = $1`,
                [req.user.id]
            );
            if (result.rows.length > 0) {
                organization = result.rows[0].organization;
            }
        }

        if (!organization) {
            return res.status(400).json({ message: 'Could not determine organization for the user' });
        }

        const patientsRes = await pool.query(
            `SELECT p.id, p.fullname, p.id_number 
             FROM users.patients p
             JOIN users.admins a ON p.registra_id = a.id
             WHERE a.organization = $1
             ORDER BY p.fullname ASC`,
            [organization]
        );
        return res.json({ patients: patientsRes.rows });
    } catch (error) {
        console.error('Error fetching organization patients:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get today's medication logs for the logged-in patient
router.get('/patients/my-medications', protect, async (req, res) => {
    if (req.user.role !== 'patient') {
        return res.status(403).json({ message: 'Only patients can fetch their own medication logs' });
    }
    try {
        const result = await pool.query(
            `SELECT id, patient_id, medication_time, scheduled_time::text, taken, date::text 
             FROM patients.medication_logs 
             WHERE patient_id = $1 AND date = CURRENT_DATE
             ORDER BY scheduled_time ASC`,
            [req.user.id]
        );
        return res.json({ medicationLogs: result.rows });
    } catch (error) {
        console.error('Error fetching my-medications:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Toggle today's medication log taken status
router.post('/patients/my-medications/:id/toggle', protect, async (req, res) => {
    if (req.user.role !== 'patient') {
        return res.status(403).json({ message: 'Only patients can update their medication status' });
    }
    const logId = req.params.id;
    try {
        // Verify ownership
        const logRes = await pool.query('SELECT * FROM patients.medication_logs WHERE id = $1 AND patient_id = $2', [logId, req.user.id]);
        if (logRes.rows.length === 0) {
            return res.status(404).json({ message: 'Medication log not found or unauthorized' });
        }
        
        const newTaken = !logRes.rows[0].taken;
        await pool.query('UPDATE patients.medication_logs SET taken = $1 WHERE id = $2', [newTaken, logId]);
        return res.json({ message: 'Medication log updated', taken: newTaken });
    } catch (error) {
        console.error('Error toggling medication log:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

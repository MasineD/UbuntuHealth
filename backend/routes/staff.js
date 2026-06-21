import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// Register Clinical Staff route (Admin only)
router.post('/register-staff', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can register clinical staff members' });
    }

    const { 
        employee_id,
        fullname, 
        id_number, 
        gender, 
        role, 
        password, 
        email, 
        phone_number, 
        house_number, 
        surbub, 
        municipality, 
        city 
    } = req.body;

    if (!employee_id || !fullname || !id_number || !gender || !role || !password || !phone_number || !house_number || !surbub || !municipality || !city) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    if (id_number.length !== 13) {
        return res.status(400).json({ message: 'National ID must be exactly 13 digits' });
    }

    if (phone_number.length !== 10) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    const validRoles = ['doctor/nurse', 'social worker', 'therapist'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid clinical staff role selected' });
    }

    try {
        // Check if clinical staff already exists with id_number or employee_id
        const staffExists = await pool.query('SELECT * FROM users.clinical_staff WHERE id_number = $1 OR employee_id = $2', [id_number, employee_id]);
        if (staffExists.rows.length > 0) {
            return res.status(400).json({ message: 'Clinical staff member with this ID number or Employee ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const registraId = req.user.id;

        const newStaff = await pool.query(
            `INSERT INTO users.clinical_staff (
                registra_id, employee_id, fullname, id_number, gender, role, password, email, phone_number, 
                house_number, surbub, municipality, city
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING id, employee_id, fullname, id_number, role, email`,
            [
                registraId, employee_id, fullname, id_number, gender, role, hashedPassword, email || null, phone_number,
                house_number, surbub, municipality, city
            ]
        );

        return res.status(201).json({ message: 'Clinical staff member registered successfully', staff: newStaff.rows[0] });
    } catch (error) {
        console.error('Error registering clinical staff member:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get Clinical Staff registered in the same organization as the admin
router.get('/staff', protect, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only administrative staff can view clinical staff list' });
    }

    try {
        const result = await pool.query(
            `SELECT cs.id, cs.employee_id, cs.fullname, cs.id_number, cs.gender, cs.role as staff_role, cs.email, cs.phone_number, 
                    cs.house_number, cs.surbub, cs.municipality, cs.city, cs.registra_id
             FROM users.clinical_staff cs
             JOIN users.admins a ON cs.registra_id = a.id
             WHERE a.organization = $1
             ORDER BY cs.id DESC`,
            [req.user.organization]
        );
        return res.json({ staff: result.rows });
    } catch (error) {
        console.error('Error fetching clinical staff:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get patients registered in the same organization as the logged-in clinical staff member
router.get('/staff/patients', protect, async (req, res) => {
    if (req.user.role !== 'staff') {
        return res.status(403).json({ message: 'Only clinical staff members can view patients list' });
    }

    try {
        const result = await pool.query(
            `SELECT p.id, p.fullname, p.id_number, p.gender, p.email, p.phone_number, 
                    p.house_number, p.surbub, p.municipality, p.city, p.next_of_kin_fullname, 
                    p.next_of_kin_email, p.next_of_kin_phone
             FROM users.patients p
             JOIN users.admins a ON p.registra_id = a.id
             WHERE a.organization = (
                  SELECT a2.organization 
                  FROM users.clinical_staff cs
                  JOIN users.admins a2 ON cs.registra_id = a2.id
                  WHERE cs.id = $1
             )
             ORDER BY p.id DESC`,
            [req.user.id]
        );
        return res.json({ patients: result.rows });
    } catch (error) {
        console.error('Error fetching staff patients:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;

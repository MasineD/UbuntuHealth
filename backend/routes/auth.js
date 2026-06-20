import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import protect from '../middleware/auth.js'; 

const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
};

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// User registration route
router.post('/register', async (req, res) => {
    const { fullname, identity, phone_number, email, organization, facility_code, password } = req.body;
    if (!fullname || !identity || !phone_number || !email || !organization || !facility_code || !password) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }
    
    const userExists = await pool.query('SELECT * FROM users.admins WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
        return res.status(400).json({ message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
        'INSERT INTO users.admins (fullname, identity, phone_number, email, organization, facility_code, password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, fullname, email',
        [fullname, identity, phone_number, email, organization, facility_code, hashedPassword]
    );
    
    const token = generateToken(newUser.rows[0].id, 'admin');
    res.cookie('token', token, cookieOptions);
    
    return res.status(201).json({ user: { ...newUser.rows[0], role: 'admin' } });
});

// User login route
router.post('/login', async (req, res) => {
    const { identity, password } = req.body;
    if (!identity || !password) {
        return res.status(400).json({ message: 'Please provide identity and password' });
    }

    // 1. Try to find admin
    let user = await pool.query('SELECT * FROM users.admins WHERE identity = $1', [identity]);
    let role = 'admin';

    // 2. If not found, try to find patient using id_number
    if (user.rows.length === 0) {
        user = await pool.query('SELECT * FROM users.patients WHERE id_number = $1', [identity]);
        role = 'patient';
    }

    // 3. If not found, try to find CHW using id_number
    if (user.rows.length === 0) {
        user = await pool.query('SELECT * FROM users.comm_health_workers WHERE id_number = $1', [identity]);
        role = 'chw';
    }

    if (user.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const userData = user.rows[0];
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(userData.id, role);
    res.cookie('token', token, cookieOptions);
    
    if (role === 'admin') {
        return res.json({ 
            user: { 
                id: userData.id, 
                name: userData.fullname, 
                email: userData.email, 
                organization: userData.organization, 
                facility_code: userData.facility_code,
                role: 'admin'
            } 
        });
    } else if (role === 'chw') {
        return res.json({
            user: {
                id: userData.id,
                name: userData.fullname,
                email: userData.email,
                id_number: userData.id_number,
                employee_id: userData.employee_id,
                gender: userData.gender,
                phone_number: userData.phone_number,
                role: 'chw'
            }
        });
    } else {
        return res.json({
            user: {
                id: userData.id,
                name: userData.fullname,
                email: userData.email,
                id_number: userData.id_number,
                gender: userData.gender,
                phone_number: userData.phone_number,
                role: 'patient'
            }
        });
    }
});

// Current user route - returns full user info from request (attached by protect middleware)
router.get('/current', protect, async (req, res) => {
    res.json({ user: req.user });
});

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
                next_of_kin_email || null, next_of_kin_phone
            ]
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

// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.json({ message: 'Logged out successfully' });
});

export default router;
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
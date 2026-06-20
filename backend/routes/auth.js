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
    
    try {
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
    } catch (error) {
        console.error('Error during registration:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// User login route
router.post('/login', async (req, res) => {
    const { identity, password } = req.body;
    if (!identity || !password) {
        return res.status(400).json({ message: 'Please provide identity and password' });
    }

    try {
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

        // 4. If not found, try to find clinical staff using id_number
        if (user.rows.length === 0) {
            user = await pool.query('SELECT * FROM users.clinical_staff WHERE id_number = $1', [identity]);
            role = 'staff';
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
        } else if (role === 'staff') {
            return res.json({
                user: {
                    id: userData.id,
                    name: userData.fullname,
                    email: userData.email,
                    id_number: userData.id_number,
                    employee_id: userData.employee_id,
                    gender: userData.gender,
                    phone_number: userData.phone_number,
                    staff_role: userData.role,
                    role: 'staff'
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
    } catch (error) {
        console.error('Error during login:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Current user route - returns full user info from request (attached by protect middleware)
router.get('/current', protect, async (req, res) => {
    res.json({ user: req.user });
});

// Get logged-in user's organization name
router.get('/my-organization', protect, async (req, res) => {
    try {
        let organization;
        if (req.user.role === 'admin') {
            organization = req.user.organization;
        } else {
            let table = 'users.clinical_staff';
            if (req.user.role === 'chw') {
                table = 'users.comm_health_workers';
            } else if (req.user.role === 'patient') {
                table = 'users.patients';
            }
            const result = await pool.query(
                `SELECT a.organization 
                 FROM ${table} u 
                 JOIN users.admins a ON u.registra_id = a.id 
                 WHERE u.id = $1`,
                [req.user.id]
            );
            if (result.rows.length > 0) {
                organization = result.rows[0].organization;
            }
        }
        return res.json({ organization });
    } catch (error) {
        console.error('Error fetching user organization:', error.message);
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
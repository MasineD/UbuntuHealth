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

// Get current user's profile details
router.get('/profile', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        if (role === 'admin') {
            const result = await pool.query(
                'SELECT id, fullname, identity, phone_number, email, organization, facility_code FROM users.admins WHERE id = $1',
                [userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Admin profile not found' });
            }
            return res.json({ profile: result.rows[0], role });
        } else if (role === 'staff') {
            const result = await pool.query(
                `SELECT s.id, s.employee_id, s.fullname, s.id_number, s.gender, s.role as staff_role, s.email, s.phone_number, s.house_number, s.surbub, s.municipality, s.city, a.organization 
                 FROM users.clinical_staff s
                 LEFT JOIN users.admins a ON s.registra_id = a.id
                 WHERE s.id = $1`,
                [userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Staff profile not found' });
            }
            return res.json({ profile: result.rows[0], role });
        } else if (role === 'chw') {
            const result = await pool.query(
                `SELECT c.id, c.employee_id, c.fullname, c.id_number, c.gender, c.email, c.phone_number, c.house_number, c.surbub, c.municipality, c.city, a.organization 
                 FROM users.comm_health_workers c
                 LEFT JOIN users.admins a ON c.registra_id = a.id
                 WHERE c.id = $1`,
                [userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'CHW profile not found' });
            }
            return res.json({ profile: result.rows[0], role });
        } else if (role === 'patient') {
            const result = await pool.query(
                `SELECT p.id, p.fullname, p.id_number, p.gender, p.email, p.phone_number, p.house_number, p.surbub, p.municipality, p.city, p.next_of_kin_fullname, p.next_of_kin_email, p.next_of_kin_phone, a.organization 
                 FROM users.patients p
                 LEFT JOIN users.admins a ON p.registra_id = a.id
                 WHERE p.id = $1`,
                [userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Patient profile not found' });
            }
            return res.json({ profile: result.rows[0], role });
        } else {
            return res.status(400).json({ message: 'Invalid user role' });
        }
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Update current user's profile details
router.put('/profile', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const updates = req.body;

        if (role === 'admin') {
            const { fullname, phone_number, email } = updates;
            if (!fullname || !phone_number || !email) {
                return res.status(400).json({ message: 'Full name, phone number, and email are required' });
            }

            await pool.query(
                'UPDATE users.admins SET fullname = $1, phone_number = $2, email = $3 WHERE id = $4',
                [fullname, phone_number, email, userId]
            );

            const updated = await pool.query(
                'SELECT id, fullname, identity, phone_number, email, organization, facility_code FROM users.admins WHERE id = $1',
                [userId]
            );
            const profileData = updated.rows[0];
            return res.json({ 
                message: 'Profile updated successfully', 
                profile: profileData, 
                role,
                user: { 
                    id: userId, 
                    name: profileData.fullname, 
                    email: profileData.email, 
                    organization: profileData.organization, 
                    facility_code: profileData.facility_code, 
                    role: 'admin' 
                }
            });
        } else if (role === 'staff') {
            const { fullname, gender, email, phone_number, house_number, surbub, municipality, city } = updates;
            if (!fullname || !gender || !phone_number) {
                return res.status(400).json({ message: 'Full name, gender, and phone number are required' });
            }

            await pool.query(
                `UPDATE users.clinical_staff 
                 SET fullname = $1, gender = $2, email = $3, phone_number = $4, house_number = $5, surbub = $6, municipality = $7, city = $8 
                 WHERE id = $9`,
                [fullname, gender, email || null, phone_number, house_number || null, surbub || null, municipality || null, city || null, userId]
            );

            const updated = await pool.query(
                `SELECT s.id, s.employee_id, s.fullname, s.id_number, s.gender, s.role as staff_role, s.email, s.phone_number, s.house_number, s.surbub, s.municipality, s.city, a.organization 
                 FROM users.clinical_staff s
                 LEFT JOIN users.admins a ON s.registra_id = a.id
                 WHERE s.id = $1`,
                [userId]
            );
            const profileData = updated.rows[0];
            return res.json({ 
                message: 'Profile updated successfully', 
                profile: profileData, 
                role,
                user: { 
                    id: userId, 
                    name: profileData.fullname, 
                    email: profileData.email, 
                    id_number: profileData.id_number, 
                    employee_id: profileData.employee_id, 
                    gender: profileData.gender, 
                    phone_number: profileData.phone_number, 
                    staff_role: profileData.staff_role, 
                    role: 'staff' 
                }
            });
        } else if (role === 'chw') {
            const { fullname, gender, email, phone_number, house_number, surbub, municipality, city } = updates;
            if (!fullname || !gender || !phone_number) {
                return res.status(400).json({ message: 'Full name, gender, and phone number are required' });
            }

            await pool.query(
                `UPDATE users.comm_health_workers 
                 SET fullname = $1, gender = $2, email = $3, phone_number = $4, house_number = $5, surbub = $6, municipality = $7, city = $8 
                 WHERE id = $9`,
                [fullname, gender, email || null, phone_number, house_number || null, surbub || null, municipality || null, city || null, userId]
            );

            const updated = await pool.query(
                `SELECT c.id, c.employee_id, c.fullname, c.id_number, c.gender, c.email, c.phone_number, c.house_number, c.surbub, c.municipality, c.city, a.organization 
                 FROM users.comm_health_workers c
                 LEFT JOIN users.admins a ON c.registra_id = a.id
                 WHERE c.id = $1`,
                [userId]
            );
            const profileData = updated.rows[0];
            return res.json({ 
                message: 'Profile updated successfully', 
                profile: profileData, 
                role,
                user: { 
                    id: userId, 
                    name: profileData.fullname, 
                    email: profileData.email, 
                    id_number: profileData.id_number, 
                    employee_id: profileData.employee_id, 
                    gender: profileData.gender, 
                    phone_number: profileData.phone_number, 
                    role: 'chw' 
                }
            });
        } else if (role === 'patient') {
            const { fullname, gender, email, phone_number, house_number, surbub, municipality, city, next_of_kin_fullname, next_of_kin_email, next_of_kin_phone } = updates;
            if (!fullname || !gender || !phone_number || !next_of_kin_fullname || !next_of_kin_phone) {
                return res.status(400).json({ message: 'Full name, gender, phone number, next of kin name, and next of kin phone are required' });
            }

            await pool.query(
                `UPDATE users.patients 
                 SET fullname = $1, gender = $2, email = $3, phone_number = $4, house_number = $5, surbub = $6, municipality = $7, city = $8, next_of_kin_fullname = $9, next_of_kin_email = $10, next_of_kin_phone = $11 
                 WHERE id = $12`,
                [fullname, gender, email || null, phone_number, house_number || null, surbub || null, municipality || null, city || null, next_of_kin_fullname, next_of_kin_email || null, next_of_kin_phone, userId]
            );

            const updated = await pool.query(
                `SELECT p.id, p.fullname, p.id_number, p.gender, p.email, p.phone_number, p.house_number, p.surbub, p.municipality, p.city, p.next_of_kin_fullname, p.next_of_kin_email, p.next_of_kin_phone, a.organization 
                 FROM users.patients p
                 LEFT JOIN users.admins a ON p.registra_id = a.id
                 WHERE p.id = $1`,
                [userId]
            );
            const profileData = updated.rows[0];
            return res.json({ 
                message: 'Profile updated successfully', 
                profile: profileData, 
                role,
                user: { 
                    id: userId, 
                    name: profileData.fullname, 
                    email: profileData.email, 
                    id_number: profileData.id_number, 
                    gender: profileData.gender, 
                    phone_number: profileData.phone_number, 
                    role: 'patient' 
                }
            });
        } else {
            return res.status(400).json({ message: 'Invalid user role' });
        }
    } catch (error) {
        console.error('Error updating user profile:', error.message);
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
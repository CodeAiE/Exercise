require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const Joi = require('joi');
const cors = require('cors');
const { connect, getDb } = require('./db'); // Import the MongoDB connection functions

const app = express();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

// Secret for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('customer', 'driver', 'admin').default('customer')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// MongoDB Connection
connect().catch((err) => console.error(err));

// JWT Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Register Endpoint (simplified to use /users/:id)
app.post('/users/:id', async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { username, email, password, role } = req.body;
  const { id } = req.params; // Use the ID from the URL

  try {
    const db = getDb();
    const usersCollection = db.collection('users');

    // Check if the email is already registered
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user document
    const newUser = {
      user_id: id, // Use the dynamic user_id from URL (ERD field name)
      username,
      email,
      password: hashedPassword,
      role
    };

    const result = await usersCollection.insertOne(newUser);
    res.status(201).json({
      message: 'User registered successfully',
      user_id: result.insertedId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Endpoint (simplified to use /auth/login)
app.post('/auth/login', async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { email, password } = req.body;

  try {
    const db = getDb();
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check if password matches
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ user_id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View Passenger Ride Analytics (Aligned with ERD and Week 7 Exercise)
app.get('/analytics/passengers', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const usersCollection = db.collection('users');

    const pipeline = [
      {
        $lookup: {
          from: "rides",
          localField: "user_id",
          foreignField: "user_id",
          as: "user_rides"
        }
      },
      { $unwind: "$user_rides" },
      {
        $lookup: {
          from: "payments",
          localField: "user_rides.payment_id",
          foreignField: "_id",
          as: "payment"
        }
      },
      { $unwind: "$payment" },
      {
        $group: {
          _id: "$username",
          totalRides: { $sum: 1 },
          totalfare: { $sum: "$payment.amount" },
          avgDistance: { $avg: "$user_rides.distance" }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          totalRides: 1,
          totalfare: 1,
          avgDistance: 1
        }
      }
    ];

    const result = await usersCollection.aggregate(pipeline).toArray();
    console.log("Pipeline Result:", result); // Added debug log
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
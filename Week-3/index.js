require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const Joi = require('joi');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

// Simulated in-memory database (replace with MongoDB in production)
const users = [];
const rides = [];

// Secret for JWT (stored in environment variables)
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

const rideSchema = Joi.object({
  pickupLocation: Joi.string().required(),
  dropoffLocation: Joi.string().required()
});

const driverStatusSchema = Joi.object({
  isAvailable: Joi.boolean().required()
});

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

// Role-based Authorization Middleware
const restrictTo = (...roles) => {
  return (req, res, next) => {
    const user = users.find(u => u.id === req.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    req.user = user;
    next();
  };
};

// Customer Registration
app.post('/users', async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { username, email, password, role } = req.body;
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: users.length + 1, username, email, password: hashedPassword, role, isAvailable: false };
  users.push(user);

  res.status(201).json({ id: user.id, username, email, role });
});

// Customer Login
app.post('/auth/login', async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.status(200).json({ token, userId: user.id, role: user.role });
});

// View Profile
app.get('/users/:id', authenticate, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (user.id !== req.userId && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.status(200).json({ id: user.id, username: user.username, email: user.email, role: user.role, isAvailable: user.isAvailable });
});

// Update Driver Availability
app.patch('/drivers/:id/status', authenticate, restrictTo('driver'), (req, res) => {
  const { error } = driverStatusSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user || user.role !== 'driver') {
    return res.status(404).json({ error: 'Driver not found' });
  }
  if (user.id !== req.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { isAvailable } = req.body;
  user.isAvailable = isAvailable;
  res.status(200).json({ id: user.id, username: user.username, isAvailable });
});

// View Earnings
app.get('/drivers/:id/earnings', authenticate, restrictTo('driver'), (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user || user.role !== 'driver') {
    return res.status(404).json({ error: 'Driver not found' });
  }
  if (user.id !== req.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Mock earnings data (replace with real data in production)
  const earnings = rides
    .filter(r => r.driverId === user.id && r.status === 'completed')
    .map(r => ({ rideId: r.id, amount: 20.0, date: r.createdAt }));

  res.status(200).json(earnings);
});

// Block User
app.delete('/admin/users/:id', authenticate, restrictTo('admin'), (req, res) => {
  const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users.splice(userIndex, 1);
  res.status(204).send();
});

// View System Analytics
app.get('/admin/analytics', authenticate, restrictTo('admin'), (req, res) => {
  const analytics = {
    totalUsers: users.length,
    totalRides: rides.length,
    activeDrivers: users.filter(u => u.role === 'driver' && u.isAvailable).length
  };
  res.status(200).json(analytics);
});

// Book Ride (Customer)
app.post('/rides', authenticate, restrictTo('customer'), (req, res) => {
  const { error } = rideSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { pickupLocation, dropoffLocation } = req.body;
  const ride = {
    id: rides.length + 1,
    customerId: req.userId,
    driverId: null,
    status: 'requested',
    pickupLocation,
    dropoffLocation,
    createdAt: new Date()
  };
  rides.push(ride);

  res.status(201).json(ride);
});

// Accept Ride (Driver)
app.patch('/rides/:id/accept', authenticate, restrictTo('driver'), (req, res) => {
  const ride = rides.find(r => r.id === parseInt(req.params.id));
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }
  if (ride.status !== 'requested') {
    return res.status(403).json({ error: 'Ride cannot be accepted' });
  }

  ride.driverId = req.userId;
  ride.status = 'accepted';
  res.status(200).json(ride);
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
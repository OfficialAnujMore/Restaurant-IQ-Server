import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRouter from './routes/auth.js';
import analyzeRouter from './routes/analyze.js';
import savedLocationsRouter from './routes/savedLocations.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

if (!process.env.ARCGIS_API_KEY) console.warn(' ARCGIS_API_KEY not set in .env');
if (!process.env.MONGO_URI) console.warn(' MONGO_URI not set in .env');
if (!process.env.JWT_SECRET) console.warn(' JWT_SECRET not set in .env');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/analyze', requireAuth, analyzeRouter);
app.use('/api/saved-locations', requireAuth, savedLocationsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

async function start() {
 if (process.env.MONGO_URI && process.env.MONGO_URI !== 'your_mongodb_connection_string_here') {
 try {
 await mongoose.connect(process.env.MONGO_URI);
 console.log(' MongoDB connected');
 } catch (err) {
 console.error(' MongoDB connection failed:', err.message);
 }
 } else {
 console.warn(' MONGO_URI not set — skipping database connection');
 }

 app.listen(PORT, () => {
 console.log(` RestaurantIQ server running on port ${PORT}`);
 });
}

start();

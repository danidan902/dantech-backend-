import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import loginRouter from './router/UserRouter.js';
import contactRouter from './router/ContactRouter.js';
import User from './models/User.js';
import postRouter from './router/PostRouter.js'   // ← needed for /seed-admin

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

// ===== SOCKET.IO =====
const io = new Server(server, {
  cors: { origin: 'https://dantech1.vercel.app', credentials: true },
});

app.set('io', io);   // accessible in routes via req.app.get('io')

// Verify token before allowing socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join('admins');
  console.log('👑 Admin connected:', socket.userId, socket.id);

  socket.on('disconnect', () => {
    console.log('🔴 Admin disconnected:', socket.id);
  });
});

// ===== MIDDLEWARE =====
app.use(cors({ origin: 'https://dantech1.vercel.app/', credentials: true }));
app.use(express.json());

// ===== DB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err.message));

// ===== ROUTES =====
app.use('/api', loginRouter);
app.use('/api', contactRouter);
app.use('/api/posts', postRouter);



// ===== START =====
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

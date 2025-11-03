const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');
const tabRoutes = require('./routes/tabs');
const proxy = require('express-http-proxy'); // You had this, keep it

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5000', 'file://'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// --- THIS IS THE FIX ---
// Replace your old app.use(cors(...)) with this
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'file://'
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // If the origin is in our allow list
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // NEW: If the origin is a localtunnel URL
    if (origin && origin.endsWith('.loca.lt')) return callback(null, true);
    
    // Otherwise, block the request
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
// --- END OF FIX ---

app.use(express.json());

// Your Google proxy (keep this)
app.use('/google', require('express-http-proxy')('www.googleapis.com', {
  https: true,
  proxyReqPathResolver: req => req.url,
  userResHeaderDecorator(headers, userReq) {
    headers['Access-Control-Allow-Origin'] = 'http://localhost:5173';
    return headers;
  }
}));

app.use('/api/oauth', require('./routes/oauth'));
app.use('/api', tabRoutes); // Make sure this line is correct

app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello WorkSphere' });
});

io.on('connection', (socket) => {
  console.log('Socket client connected:', socket.id);
  socket.join('test-user');
  socket.on('update', async (data) => {
    console.log('Socket update:', data);
    io.to('test-user').emit('tab-updated', data);
  });
  socket.on('disconnect', () => console.log('Socket client disconnected'));
});

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
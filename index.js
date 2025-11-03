const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Keep this import
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');
const tabRoutes = require('./routes/tabs');
const proxy = require('express-http-proxy');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // This is fine, but the app.use(cors()) below is more important
    origin: ['http://localhost:5173', 'https://worksphere-backend-zoiw.onrender.com'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// --- THIS IS THE FIX ---
// This single line allows all connections, including from OnlyOffice
app.use(cors());
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
app.use('/api', tabRoutes);

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

// Render sets the PORT environment variable
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ce bloc va s'exécuter à chaque requête reçue par Express
app.use((req, res, next) => {
  console.log(`📥 [POD: ${os.hostname()}] Requête reçue : ${req.method} ${req.originalUrl}`);
  next();
});
// ----------------------------------

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: 'unavailable', db: 'disconnected' })
  }
  res.json({ status: 'ok', db: 'connected' })
})

// Connexion MongoDB puis démarrage du serveur
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/authdb')
  .then(() => {
    console.log(`✅ Connecté à MongoDB (depuis le pod ${os.hostname()})`);
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erreur de connexion MongoDB:', err);
    process.exit(1);
  });
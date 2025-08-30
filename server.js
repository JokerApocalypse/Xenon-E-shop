const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Configuration simplifiée - On retire Multer pour l'instant
// pour se concentrer sur la connexion MongoDB

let db;
let client;

async function connectToDatabase() {
  try {
    console.log('🔄 Tentative de connexion à MongoDB Atlas...');
    
    // Plusieurs formats d'URI à essayer
    const uriOptions = [
      process.env.MONGODB_URI,
      process.env.MONGODB_URI?.replace('mongodb+srv://', 'mongodb://'),
      process.env.MONGODB_URI_ALTERNATIVE // Option de secours
    ].filter(Boolean);

    let connectionSuccess = false;
    
    for (const uri of uriOptions) {
      if (!uri) continue;
      
      try {
        console.log(`🔗 Essai avec URI: ${uri.replace(/:[^:]*@/, ':****@')}`);
        
        client = new MongoClient(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000
        });
        
        await client.connect();
        db = client.db();
        connectionSuccess = true;
        console.log('✅ Connecté à MongoDB Atlas');
        break;
        
      } catch (uriError) {
        console.log(`❌ Échec avec cette URI: ${uriError.message}`);
        if (client) {
          await client.close().catch(() => {});
        }
      }
    }
    
    if (!connectionSuccess) {
      throw new Error('Toutes les tentatives de connexion ont échoué');
    }
    
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    console.log('💡 Solutions possibles:');
    console.log('   1. Créer un nouvel utilisateur avec mot de passe simple');
    console.log('   2. Vérifier les règles Network Access dans MongoDB Atlas');
    console.log('   3. Utiliser une URI standard au lieu de SRV');
    process.exit(1);
  }
}

// Routes basiques pour tester
app.get('/api/test', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Base de données non connectée' });
    }
    
    const collections = await db.listCollections().toArray();
    res.json({ 
      status: 'OK', 
      message: 'API fonctionnelle',
      collections: collections.map(c => c.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Servir la page principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Démarrer le serveur
async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage:', error);
    process.exit(1);
  }
}

// Gestion de la fermeture
process.on('SIGINT', async () => {
  console.log('\n📴 Arrêt du serveur...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});

startServer();

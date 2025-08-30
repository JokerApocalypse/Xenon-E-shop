const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Configuration de Multer pour le upload d'images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/products/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Connexion MongoDB
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db();
    console.log('✅ Connecté à MongoDB Atlas');
    
    // Créer les index pour optimiser les recherches
    await db.collection('products').createIndex({ name: 'text', description: 'text' });
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('orders').createIndex({ userId: 1 });
    
    console.log('✅ Index MongoDB créés');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error);
    process.exit(1);
  }
}

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès requis' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// Middleware d'administration
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
};

// Routes de l'API

// Route de test
app.get('/api/test', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json({ 
      status: 'OK', 
      message: 'API Boutique Tante fonctionnelle',
      collections: collections.map(c => c.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes des produits
app.get('/api/products', async (req, res) => {
  try {
    const { category, featured, page = 1, limit = 12, search } = req.query;
    const query = {};
    
    if (category && category !== 'all') query.category = category;
    if (featured === 'true') query.featured = true;
    if (search) {
      query.$text = { $search: search };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const products = await db.collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await db.collection('products').countDocuments(query);
    
    res.json({
      products,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const productData = {
      ...req.body,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      featured: req.body.featured === 'true',
      createdAt: new Date()
    };

    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
    }

    const result = await db.collection('products').insertOne(productData);
    res.status(201).json({ 
      message: 'Produit créé avec succès', 
      productId: result.insertedId 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Routes d'authentification
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Créer l'utilisateur
    const user = {
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      createdAt: new Date(),
      address: {},
      phone: ''
    };
    
    const result = await db.collection('users').insertOne(user);
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId: result.insertedId, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      token,
      user: {
        id: result.insertedId,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Trouver l'utilisateur
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes du panier
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(req.user.userId) 
    });
    
    res.json({ cart: user.cart || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(productId) 
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const cartItem = {
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: parseInt(quantity) || 1
    };
    
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { 
        $push: { 
          cart: {
            $each: [cartItem],
            $sort: { name: 1 }
          }
        } 
      }
    );
    
    res.json({ message: 'Produit ajouté au panier', item: cartItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes des commandes
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(req.user.userId) 
    });
    
    if (!user.cart || user.cart.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide' });
    }
    
    // Calculer le total
    const totalAmount = user.cart.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Créer la commande
    const order = {
      userId: user._id,
      products: user.cart,
      totalAmount,
      status: 'pending',
      shippingAddress,
      paymentMethod,
      paymentStatus: 'pending',
      createdAt: new Date()
    };
    
    const result = await db.collection('orders').insertOne(order);
    
    // Vider le panier
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { cart: [] } }
    );
    
    res.status(201).json({
      message: 'Commande créée avec succès',
      orderId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Servir les fichiers uploadés
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir les pages principales
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/mentions-legales', (req, res) => {
  res.sendFile(path.join(__dirname, 'ressources/mentions-legales.html'));
});

app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trouvé' });
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
  console.error('Erreur:', error);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrer le serveur
async function startServer() {
  await connectToDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/test`);
  });
}

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
  console.log('\n📴 Arrêt du serveur...');
  await client.close();
  console.log('✅ MongoDB déconnecté');
  process.exit(0);
});

// Démarrer l'application
startServer().catch(error => {
  console.error('❌ Erreur lors du démarrage du serveur:', error);
  process.exit(1);
});

module.exports = app;

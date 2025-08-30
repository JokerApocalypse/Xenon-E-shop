const express = require('express');
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

// Données en mémoire (simulation de base de données)
let products = [
  {
    _id: '1',
    name: 'Ordinateur Portable HP',
    description: 'Ordinateur portable 15.6", 8GB RAM, 512GB SSD, Intel Core i5',
    price: 450000,
    category: 'ordinateurs',
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    stock: 10,
    featured: true,
    createdAt: new Date()
  },
  {
    _id: '2',
    name: 'Veste en Cuir Premium',
    description: 'Veste en cuir véritable pour homme, style motard',
    price: 85000,
    category: 'vetements',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    stock: 15,
    featured: true,
    createdAt: new Date()
  },
  {
    _id: '3',
    name: 'Machine à Coudre Professionnelle',
    description: 'Machine à coudre avec 32 points programmés, idéale pour la confection',
    price: 120000,
    category: 'confection',
    image: 'https://images.unsplash.com/photo-1506629905877-52a5ca6d63b1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    stock: 8,
    featured: false,
    createdAt: new Date()
  },
  {
    _id: '4',
    name: 'Robe Élégante Soirée',
    description: 'Robe longue élégante pour occasions spéciales, plusieurs coloris disponibles',
    price: 65000,
    category: 'vetements',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    stock: 12,
    featured: true,
    createdAt: new Date()
  }
];

let users = [
  {
    _id: '1',
    name: 'Admin',
    email: 'admin@boutique.com',
    password: '$2a$12$L7Lk7kC9C9C9C9C9C9C9C.C9C9C9C9C9C9C9C9C9C9C9C9C9C9C9C9C9', // password: admin123
    role: 'admin',
    cart: [],
    createdAt: new Date()
  }
];

let orders = [];
let nextId = 100;

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
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Boutique Tante fonctionnelle',
    timestamp: new Date().toISOString(),
    productsCount: products.length,
    usersCount: users.length,
    ordersCount: orders.length
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Serveur en fonctionnement',
    timestamp: new Date().toISOString()
  });
});

// Routes des produits
app.get('/api/products', (req, res) => {
  try {
    const { category, featured, page = 1, limit = 12, search } = req.query;
    
    let filteredProducts = [...products];
    
    // Filtrage par catégorie
    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === category);
    }
    
    // Filtrage par featured
    if (featured === 'true') {
      filteredProducts = filteredProducts.filter(p => p.featured);
    }
    
    // Filtrage par recherche
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(searchLower) || 
        p.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    res.json({
      products: paginatedProducts,
      total: filteredProducts.length,
      totalPages: Math.ceil(filteredProducts.length / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = products.find(p => p._id === req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', authenticateToken, requireAdmin, (req, res) => {
  try {
    const productData = {
      _id: (nextId++).toString(),
      ...req.body,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      featured: req.body.featured === 'true',
      createdAt: new Date()
    };

    products.push(productData);
    
    res.status(201).json({ 
      message: 'Produit créé avec succès', 
      productId: productData._id 
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
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email existe déjà' });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Créer l'utilisateur
    const user = {
      _id: (nextId++).toString(),
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      createdAt: new Date(),
      address: {},
      phone: '',
      cart: []
    };
    
    users.push(user);
    
    // Générer le token JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Utilisateur créé avec succès',
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

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Trouver l'utilisateur
    const user = users.find(u => u.email === email);
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
app.get('/api/cart', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u._id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json({ cart: user.cart || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart', authenticateToken, (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    const product = products.find(p => p._id === productId);
    
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
    
    const userIndex = users.findIndex(u => u._id === req.user.userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    // Ajouter au panier
    const existingItemIndex = users[userIndex].cart.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {
      users[userIndex].cart[existingItemIndex].quantity += cartItem.quantity;
    } else {
      users[userIndex].cart.push(cartItem);
    }
    
    res.json({ message: 'Produit ajouté au panier', cart: users[userIndex].cart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Routes des commandes
app.post('/api/orders', authenticateToken, (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    const user = users.find(u => u._id === req.user.userId);
    
    if (!user || !user.cart || user.cart.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide' });
    }
    
    // Calculer le total
    const totalAmount = user.cart.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    // Créer la commande
    const order = {
      _id: (nextId++).toString(),
      userId: user._id,
      products: [...user.cart],
      totalAmount,
      status: 'pending',
      shippingAddress,
      paymentMethod,
      paymentStatus: 'pending',
      createdAt: new Date()
    };
    
    orders.push(order);
    
    // Vider le panier
    user.cart = [];
    
    res.status(201).json({
      message: 'Commande créée avec succès',
      orderId: order._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/test`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 Produits chargés: ${products.length}`);
  console.log(`👤 Utilisateurs: ${users.length}`);
});

module.exports = app;

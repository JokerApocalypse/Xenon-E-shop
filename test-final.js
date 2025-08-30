const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function testFinalConnection() {
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB Atlas avec succès!');
    
    // Test de la base de données
    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    console.log('📊 Bases de données disponibles:');
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });
    
    // Créer une collection de test si elle n'existe pas
    const testCollection = db.collection('test_connection');
    await testCollection.insertOne({
      message: 'Test de connexion réussi',
      timestamp: new Date(),
      status: 'success'
    });
    
    console.log('📝 Document de test inséré avec succès');
    
    // Vérifier l'insertion
    const testDoc = await testCollection.findOne({});
    console.log('📋 Document récupéré:', testDoc);
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
  } finally {
    await client.close();
    console.log('🔌 Connexion fermée');
  }
}

testFinalConnection();

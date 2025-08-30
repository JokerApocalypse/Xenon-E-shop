const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sellurookashilSons_db_user:p2/RgDMq8mevWSUJZ@cluster0.8218gaz.mongodb.net/boutique-tante?retryWrites=true&w=majority&appName=Cluster0";

async function testConnection() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB Atlas avec succès!');
    
    // Lister les bases de données pour vérifier la connexion
    const databasesList = await client.db().admin().listDatabases();
    console.log("Bases de données disponibles:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
  } finally {
    await client.close();
  }
}

testConnection();

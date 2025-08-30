// debug-uri.js
const { ConnectionString } = require('mongodb-connection-string-url');

function debugMongoURI(uri) {
  console.log('🔍 Debug URI MongoDB:');
  console.log('URI complète:', uri.replace(/:[^:]*@/, ':****@'));
  
  try {
    const cs = new ConnectionString(uri);
    console.log('✅ URI parsée avec succès');
    console.log('Protocol:', cs.protocol);
    console.log('Hosts:', cs.hosts);
    console.log('Username:', cs.username);
    console.log('Password:', cs.password ? '****' : 'none');
    console.log('Database:', cs.pathname.substring(1));
    console.log('Search params:', cs.searchParams.toString());
  } catch (error) {
    console.log('❌ Erreur de parsing:', error.message);
    
    // Test d'encodage manuel
    console.log('\n🔧 Test d\'encodage manuel:');
    const testURI = 'mongodb+srv://test:pass%2Fword@cluster0.example.com/test';
    try {
      const testCS = new ConnectionString(testURI);
      console.log('URI test encodée fonctionne:', testURI);
    } catch (e) {
      console.log('Même le test échoue:', e.message);
    }
  }
}

// Test avec votre URI (remplacez par la vraie URI)
const testURI = process.env.MONGODB_URI || 'mongodb+srv://sellurookashilSons_db_user:p2%2FRgDMq8mevWSUJZ@cluster0.8218gaz.mongodb.net/boutique-tante?retryWrites=true&w=majority&appName=Cluster0';
debugMongoURI(testURI);

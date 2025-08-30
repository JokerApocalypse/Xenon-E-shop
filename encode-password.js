// encode-password.js
function encodeMongoDBPassword(password) {
  return encodeURIComponent(password);
}

// Test avec votre mot de passe
const password = 'p2/RgDMq8mevWSUJZ';
const encodedPassword = encodeMongoDBPassword(password);

console.log('Mot de passe original:', password);
console.log('Mot de passe encodé:', encodedPassword);
console.log('URI complète:');
console.log(`mongodb+srv://sellurookashilSons_db_user:${encodedPassword}@cluster0.8218gaz.mongodb.net/boutique-tante?retryWrites=true&w=majority&appName=Cluster0`);

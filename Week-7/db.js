// db.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI || "mongodb://localhost:27017"; // Using environment variable for flexibility
let db;
let client;

async function connect() {
  if (db) return db; // Return cached db connection if it already exists
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("testDB"); // Use your database name here
  console.log('Connected to MongoDB');
  return db;
}

function getDb() {
  return db;
}

module.exports = { connect, getDb };

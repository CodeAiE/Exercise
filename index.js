const { MongoClient } = require("mongodb");

// Connection string for local MongoDB (default port 27017)
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB!");

    // Select database "testDB" and collection "users"
    const database = client.db("testDB");
    const users = database.collection("users");

    // Insert a document
    const doc = { name: "John Doe", age: 25 };
    const result = await users.insertOne(doc);
    console.log(`Document inserted with _id: ${result.insertedId}`);

    // Read the inserted document
    const insertedDoc = await users.findOne({ _id: result.insertedId });
    console.log("Found document:", insertedDoc);
  } finally {
    // Close the connection
    await client.close();
  }
}

// Run the function and handle errors
run().catch(console.dir);
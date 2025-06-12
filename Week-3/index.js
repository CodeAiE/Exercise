const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const port = 3000;
const app = express();

app.use(express.json());

let db;

async function connectToMongoDB() {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        db = client.db("testDB");
    } catch (err) {
        console.error("Error:", err);
    }
}

connectToMongoDB();

app.get('/rides', async (req, res) => {
    try {
        const rides = await db.collection('rides').find().toArray();
        res.status(200).json(rides);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch rides" });
    }
});

app.get('/rides/:id', async (req, res) => {
    try {
        const rideId = req.params.id;
        if (!ObjectId.isValid(rideId)) {
            return res.status(400).json({ error: "Invalid ride ID format" });
        }
        const ride = await db.collection('rides').findOne({ _id: new ObjectId(rideId) });
        if (!ride) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json(ride);
    } catch (err) {
        console.error("GET /rides/:id Error:", err);
        res.status(500).json({ error: "Failed to fetch ride" });
    }
});

app.post('/rides', async (req, res) => {
    try {
        const ride = req.body;
        const result = await db.collection('rides').insertOne(ride);
        res.status(201).json({ message: "Ride created", id: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: "Failed to create ride" });
    }
});

app.put('/rides/:id', async (req, res) => {
    try {
        const rideId = req.params.id;
        if (!ObjectId.isValid(rideId)) {
            return res.status(400).json({ error: "Invalid ride ID format" });
        }
        const ride = req.body;
        if (!ride.pickupLocation || !ride.destination || !ride.driverId || !ride.status) {
            return res.status(400).json({ error: "Missing required fields: pickupLocation, destination, driverId, status" });
        }
        const result = await db.collection('rides').replaceOne(
            { _id: new ObjectId(rideId) },
            ride
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json({ message: "Ride updated" });
    } catch (err) {
        console.error("PUT Error:", err);
        res.status(500).json({ error: "Failed to update ride" });
    }
});

app.patch('/rides/:id', async (req, res) => {
    try {
        const rideId = req.params.id;
        if (!ObjectId.isValid(rideId)) {
            return res.status(400).json({ error: "Invalid ride ID format" });
        }
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: "Status is required" });
        }
        const result = await db.collection('rides').updateOne(
            { _id: new ObjectId(rideId) },
            { $set: { status } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json({ message: "Ride status updated", modifiedCount: result.modifiedCount });
    } catch (err) {
        console.error("PATCH Error:", err);
        res.status(500).json({ error: "Failed to update ride" });
    }
});

app.delete('/rides/:id', async (req, res) => {
    try {
        const rideId = req.params.id;
        if (!ObjectId.isValid(rideId)) {
            return res.status(400).json({ error: "Invalid ride ID format" });
        }
        const result = await db.collection('rides').deleteOne(
            { _id: new ObjectId(rideId) }
        );
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json({ message: "Ride deleted" });
    } catch (err) {
        console.error("DELETE Error:", err);
        res.status(500).json({ error: "Failed to delete ride" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

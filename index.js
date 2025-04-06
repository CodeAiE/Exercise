const { MongoClient } = require('mongodb'); // Fixed typo from 'NonpoClient'

// Define drivers array correctly
const drivers = [
    {
        name: "John Doe",
        vehicleType: "Sedan",
        isAvailable: true,
        rating: 4.8
    },
    {
        name: "Alice Smith",
        vehicleType: "SUV",
        isAvailable: false,
        rating: 4.5
    }
];

// Show all data in console
console.log("All drivers:", drivers);

// Show all driver names
drivers.forEach(driver => console.log(driver.name));

// Add new driver
drivers.push({
    name: "Bob Johnson",
    vehicleType: "Truck",
    isAvailable: true,
    rating: 4.7
});

async function main() {
    const uri = "mongodb://localhost:27017"; // Replace with your MongoDB connection string
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("testDB");
        const driversCollection = db.collection("drivers");

        // Task 3: Insert all drivers
        await Promise.all(drivers.map(async (driver) => {
            const result = await driversCollection.insertOne(driver);
            console.log(`New driver created with result: ${JSON.stringify(result)}`);
        }));

        // Task 4: Query available drivers with rating >= 4.5
        const availableDrivers = await driversCollection.find({
            isAvailable: true,
            rating: { $gte: 4.5 }
        }).toArray();
        console.log("Available drivers:", availableDrivers);

        // Task 5: Update John Doe's rating
        const updateResult = await driversCollection.updateOne(
            { name: "John Doe" },
            { $inc: { rating: 0.1 } }
        );
        console.log('Driver updated with result:', updateResult);

        // Task 6: Delete unavailable drivers
        const deleteResult = await driversCollection.deleteOne(
            { isAvailable: false }
        );
        console.log('Driver deleted with result:', deleteResult);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

main();
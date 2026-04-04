
const { Client } = require('pg');
require('dotenv').config();

async function createSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL.replace('schema=universal_vms', 'schema=public')
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        await client.query('CREATE SCHEMA IF NOT EXISTS universal_vms');
        console.log("Schema 'universal_vms' created or already exists.");

    } catch (err) {
        console.error("Error creating schema:", err);
    } finally {
        await client.end();
    }
}

createSchema();

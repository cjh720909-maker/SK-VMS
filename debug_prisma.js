
console.log("Loading Prisma...");
const { PrismaClient } = require('@prisma/client');
console.log("Instantiating Prisma...");
const prisma = new PrismaClient();
console.log("Prisma instantiated.");
prisma.$connect().then(() => {
    console.log("Connected!");
    process.exit(0);
}).catch(e => {
    console.error("Failed:", e);
    process.exit(1);
});

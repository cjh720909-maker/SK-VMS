
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function copyData() {
    // List of tables to migrate
    const tables = ['NPS_t_balju', 'NPS_t_car', 'NPS_t_code_340', 'NPS_t_product', 'NPS_t_customer'];

    try {
        console.log("Starting data migration from universal_vms to SK_vms...");

        for (const table of tables) {
            try {
                console.log(`Processing table: ${table}`);

                // 1. Truncate target
                await prisma.$executeRawUnsafe(`TRUNCATE TABLE "SK_vms"."${table}" RESTART IDENTITY`);
                console.log(` - Truncated SK_vms.${table}`);

                // 2. Copy from source
                await prisma.$executeRawUnsafe(`INSERT INTO "SK_vms"."${table}" SELECT * FROM "universal_vms"."${table}"`);

                const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "SK_vms"."${table}"`);
                console.log(` - Successfully copied ${countResult[0]?.count || 0} rows to ${table}`);
            } catch (tableError) {
                console.error(` ! Error processing ${table}:`, tableError.message);
            }
        }

        console.log("Migration process finished.");
    } catch (e) {
        console.error("Global migration error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

copyData();

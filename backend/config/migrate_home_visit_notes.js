import pool from './database.js';

async function migrate() {
  try {
    console.log("Adding visit_notes column to patients.compliance_alerts...");
    await pool.query(`
      ALTER TABLE patients.compliance_alerts ADD COLUMN IF NOT EXISTS visit_notes TEXT NULL;
    `);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();

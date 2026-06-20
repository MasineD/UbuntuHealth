import pool from './database.js';

async function migrate() {
  try {
    console.log("Running migration for patients.compliance_alerts...");
    await pool.query(`
      ALTER TABLE patients.compliance_alerts ADD COLUMN IF NOT EXISTS chw_id INT NULL;
      ALTER TABLE patients.compliance_alerts ADD COLUMN IF NOT EXISTS visit_status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE patients.compliance_alerts ADD COLUMN IF NOT EXISTS visit_reason TEXT DEFAULT 'Medication Non-Compliance Follow-up';
      ALTER TABLE patients.compliance_alerts ADD COLUMN IF NOT EXISTS visit_date DATE NULL;
    `);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();

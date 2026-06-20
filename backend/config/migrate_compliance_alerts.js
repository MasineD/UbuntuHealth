import pool from './database.js';

async function migrate() {
  try {
    console.log("Running migration for patients.compliance_alerts...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients.compliance_alerts (
          id SERIAL PRIMARY KEY,
          patient_id INT NOT NULL,
          date DATE DEFAULT CURRENT_DATE,
          visit_scheduled BOOLEAN DEFAULT FALSE,
          UNIQUE(patient_id, date)
      );
    `);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();

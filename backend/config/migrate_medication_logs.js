import pool from './database.js';

async function migrate() {
  try {
    console.log("Running migration for patients.medication_logs...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patients.medication_logs (
          id SERIAL PRIMARY KEY,
          patient_id INT NOT NULL,
          medication_time VARCHAR(20) NOT NULL, -- 'morning', 'midday', 'evening'
          scheduled_time TIME NOT NULL,
          taken BOOLEAN DEFAULT FALSE,
          date DATE DEFAULT CURRENT_DATE,
          UNIQUE(patient_id, medication_time, date)
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

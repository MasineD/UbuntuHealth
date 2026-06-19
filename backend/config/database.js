// ========== Connecting to the database ==========
import { Pool} from "pg";       //This allows connecting Node.js with PostgreSQL database
import dotenv from "dotenv";    //To allow loading environment variables from a .env file, which is useful for storing sensitive information like database credentials and API keys.

dotenv.config();

const pool = new Pool({
    // connectionString : process.env.DATABASE_URL,
    // ssl: process.env.NODE_ENV ===  "production" ? { rejectUnauthorized: false } : false,
    host: process.env.DB_HOST,       //Database host, typically 'localhost' for local development
    port: process.env.DB_PORT,       //Database port, default is 5432 for PostgreSQL
    user: process.env.DB_USER,       //Database user
    password: process.env.DB_PASSWORD, //Database password
    database: process.env.DB_NAME    //Database name
});

pool.on("connect", () => {
    console.log("Connected to the database successfully!");
});

pool.on("error", (err) => {
    console.error("Unexpected database error:", err);
});
export default pool;
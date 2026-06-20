import pool from './database.js';

const migrateChat = async () => {
    try {
        console.log('Running database migration for chat messages...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks.chat_messages (
                id BIGSERIAL PRIMARY KEY,
                sender_id BIGINT NOT NULL,
                sender_role VARCHAR(50) NOT NULL,
                sender_name VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NOT NULL,
                recipient_type VARCHAR(50) NOT NULL,
                recipient_id BIGINT,
                recipient_role VARCHAR(50),
                message_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database migration for chat messages completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error running chat migration:', error.message);
        process.exit(1);
    }
};

migrateChat();

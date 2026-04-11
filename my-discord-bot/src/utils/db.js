import Database from 'better-sqlite3';

let db;

export async function initDB() {
    if (db) return db;

    db = new Database('./database.sqlite');

    // Set some pragmas for performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item TEXT NOT NULL,
            created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            remind_at INTEGER,
            channel_id TEXT
        );
        CREATE TABLE IF NOT EXISTS levels (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 0,
            last_xp_time INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id)
        );
    `);

    console.log("✅ Database initialized (better-sqlite3)");
    return db;
}

export function getDB() {
    if (!db) {
        // Direct initialization if called before initDB
        db = new Database('./database.sqlite');
        db.pragma('journal_mode = WAL');
    }
    return db;
}

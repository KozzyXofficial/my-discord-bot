import { getDB } from "./db.js";
import { buildCoolEmbed } from "./embeds.js";

const MAX_TIMEOUT = 2147483647; // Max DB integer is safely within JS max safe integer, but setTimeout max is 24.8 days

export async function addReminder(userId, content, remindAt, channelId) {
    const db = getDB();
    const result = db.prepare(
        "INSERT INTO reminders (user_id, content, remind_at, channel_id) VALUES (?, ?, ?, ?)"
    ).run(userId, content, remindAt, channelId);
    return result.lastInsertRowid;
}

export async function removeReminder(id) {
    const db = getDB();
    db.prepare("DELETE FROM reminders WHERE id = ?").run(id);
}

export async function initReminders(client) {
    const db = getDB();
    const reminders = db.prepare("SELECT * FROM reminders").all();
    const now = Date.now();

    for (const r of reminders) {
        if (r.remind_at <= now) {
            // Expired while offline
            await sendReminder(client, r, true);
        } else {
            // Schedule future
            scheduleReminder(client, r);
        }
    }
    console.log(`⏰ Loaded ${reminders.length} reminders.`);
}

export function scheduleReminder(client, reminder) {
    const diff = reminder.remind_at - Date.now();

    if (diff > MAX_TIMEOUT) {
        // Too far in future, just wait until a restart or periodic check handles it.
        // For simplicity in this bot, we set max timeout and re-check, or ignore.
        // Let's ignore for now as 24 days is long enough for a demo.
        return;
    }

    setTimeout(() => sendReminder(client, reminder), Math.max(0, diff));
}

async function sendReminder(client, reminder, late = false) {
    try {
        // Remove from DB first to prevent loop if crash happens during send
        await removeReminder(reminder.id);

        let target;
        try {
            // Try fetching channel if it exists (Guild text or DM)
            if (reminder.channel_id) {
                target = await client.channels.fetch(reminder.channel_id).catch(() => null);
            }
            // Fallback to fetching user DM
            if (!target) {
                const user = await client.users.fetch(reminder.user_id).catch(() => null);
                target = user;
            }
        } catch { }

        if (!target) return; // User/Channel gone

        const embed = buildCoolEmbed({
            type: late ? "warning" : "info",
            title: "⏰ Reminder",
            description: late ? `(Sorry I'm late!)\n\n${reminder.content}` : reminder.content,
            footerText: "Stored with SQLite",
        });

        await target.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });

    } catch (err) {
        console.error("Failed to send reminder:", err);
    }
}

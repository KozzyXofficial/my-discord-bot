import { getDB } from "../utils/db.js";
import { Events, PermissionsBitField } from "discord.js";
import { getGuildSettings, afkMap, guildAutoresponders, saveSettings } from "../utils/database.js";
import { replyEmbed } from "../utils/embeds.js";
import { containsBadWords, looksSpammy, matchesTrigger, isEmojiResponse, parseHexColorToInt } from "../utils/helpers.js";

const PREFIX = ",";

export default {
    name: Events.MessageCreate,
    async execute(message, client) {
        try {
            if (!message?.guild || message.author.bot) return;

            // XP and Leveling System
            const db = getDB();
            const userId = message.author.id;
            const guildId = message.guild.id;
            const now = Math.floor(Date.now() / 1000);

            let userData = db.prepare("SELECT * FROM levels WHERE user_id = ? AND guild_id = ?").get(userId, guildId);

            if (!userData) {
                db.prepare("INSERT INTO levels (user_id, guild_id, xp, level, last_xp_time) VALUES (?, ?, ?, ?, ?)")
                    .run(userId, guildId, 0, 0, 0);
                userData = { user_id: userId, guild_id: guildId, xp: 0, level: 0, last_xp_time: 0 };
            }

            // Cooldown check (60 seconds)
            if (now - userData.last_xp_time >= 60) {
                const xpToAdd = Math.floor(Math.random() * 11) + 15; // 15-25
                const newXp = userData.xp + xpToAdd;
                const nextLevel = userData.level + 1;
                const xpNeeded = 100 * (nextLevel * nextLevel);

                let newLevel = userData.level;
                if (newXp >= xpNeeded) {
                    newLevel++;
                    await replyEmbed(message, {
                        type: "success",
                        title: "🎉 Level Up!",
                        description: `Congratulations <@${userId}>, you've reached **Level ${newLevel}**!`,
                    }).catch(() => { });
                }

                db.prepare("UPDATE levels SET xp = ?, level = ?, last_xp_time = ? WHERE user_id = ? AND guild_id = ?")
                    .run(newXp, newLevel, now, userId, guildId);
            }

            if (!message?.content) return;

            const raw = message.content;
            const lower = raw.toLowerCase();

            // AFK removal
            const afkEntry = afkMap.get(message.author.id);
            if (afkEntry) {
                afkMap.delete(message.author.id);
                await replyEmbed(message, {
                    type: "afk",
                    title: "👋 Welcome Back",
                    description: "Your AFK status has been removed.",
                }).catch(() => { });
            }

            // Mentioning AFK users
            if (message.mentions.users.size > 0) {
                const lines = [];
                for (const [, user] of message.mentions.users) {
                    const entry = afkMap.get(user.id);
                    if (entry) {
                        const mins = Math.floor((Date.now() - entry.since) / 60000);
                        lines.push(`• **${user.username}** is AFK: **${entry.reason}** (${mins} min)`);
                    }
                }
                if (lines.length > 0) {
                    await replyEmbed(message, {
                        type: "afk",
                        title: "💤 AFK Notice",
                        description: lines.join("\n"),
                    }).catch(() => { });
                }
            }

            // AUTORESPONDERS (not prefix)
            if (!raw.startsWith(PREFIX)) {
                if (!message.guild) return;

                const settings = getGuildSettings(message.guild.id);
                const filterOn = settings.autoresponderFilterOn !== false;
                const list = guildAutoresponders.get(message.guild.id) || [];

                if (filterOn) {
                    if (containsBadWords(lower, settings.badWords) || looksSpammy(raw)) return;
                }

                for (const ar of list) {
                    const trig = ar.trigger.toLowerCase();
                    const isMatch = lower === trig || raw.trim().toLowerCase() === trig || matchesTrigger(lower, trig);
                    if (!isMatch) continue;

                    const resp = String(ar.response || "").trim();
                    if (!resp) return;

                    if (isEmojiResponse(resp)) {
                        try { await message.react(resp); } catch { }
                    } else {
                        await replyEmbed(message, {
                            type: "autoresponder",
                            title: "🤖 Auto Response",
                            description: resp,
                        }).catch(() => { });
                    }
                    return;
                }
                return;
            }

            // PREFIX COMMANDS
            if (!message.guild) return;
            const args = raw.slice(PREFIX.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();
            if (!commandName) return;

            const settings = getGuildSettings(message.guild.id);

            // ---------------- EMBED COLOR COMMANDS ----------------
            // Format: ,embed_ticket_#57F287  (command token contains underscores)
            if (commandName.startsWith("embed_")) {
                if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    return replyEmbed(message, {
                        type: "error",
                        title: "⛔ Permission Needed",
                        description: "You need **Manage Server** to change embed colors.",
                    });
                }

                const parts = commandName.split("_"); // ["embed", "<type>", "<hex>"]
                const type = parts[1];
                const hexPart = parts.slice(2).join("_"); // just in case

                if (!type || !hexPart) {
                    return replyEmbed(message, {
                        type: "error",
                        title: "❌ Invalid Format",
                        description: "Use: `,embed_<type>_#hex`\nExample: `,embed_ticket_#57F287`",
                    });
                }

                const colorInt = parseHexColorToInt(hexPart);
                if (colorInt === null) {
                    return replyEmbed(message, {
                        type: "error",
                        title: "❌ Invalid Color",
                        description: "Hex must look like `#57F287` (6 hex digits).",
                    });
                }

                settings.embedColors[type] = colorInt;
                await saveSettings();

                return replyEmbed(message, {
                    type: "settings",
                    title: "🎨 Embed Color Updated",
                    description: `Set **${type}** embed color to **#${String(hexPart).replace("#", "").toUpperCase()}**.`,
                });
            }

            // Command Loader
            const command = client.prefixCommands.get(commandName) || client.prefixCommands.get(client.aliases.get(commandName));
            if (command) {
                try {
                    await command.execute(message, args, client);
                } catch (error) {
                    console.error("Command execution error:", error);
                    await replyEmbed(message, { type: "error", title: "❌ Error", description: "There was an error while executing this command!" });
                }
            } else {
                // Unknown command (embed)
                return replyEmbed(message, {
                    type: "error",
                    title: "❓ Unknown Command",
                    description: `Command not recognized: \`${PREFIX}${commandName}\`\nTry: \`,modhelp\` or \`,ticket\``,
                });
            }

        } catch (err) {
            console.error("Message handler error:", err);
        }
    }
};

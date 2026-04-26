import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload, buildCoolEmbed } from "../../utils/embeds.js";
import { getDB } from "../../utils/db.js";

const MAX_ITEMS = 50;
const MAX_ITEM_LENGTH = 500;

export default {
    data: {
        name: "todo",
        description: "Manage your personal to-do list",
        integration_types: [0, 1],
        contexts: [0, 1, 2],
        options: [
            {
                name: "add", description: "Add a new task to your list", type: 1,
                options: [{ name: "item", description: "Task description", type: 3, required: true }]
            },
            { name: "list", description: "View all your tasks", type: 1 },
            {
                name: "remove", description: "Remove a task by its ID", type: 1,
                options: [{ name: "id", description: "Task ID (from /todo list)", type: 4, required: true }]
            },
            { name: "clear", description: "Remove all your tasks", type: 1 }
        ]
    },
    async execute(i) {
        const sub = i.options.getSubcommand();
        const db = await getDB();
        const userId = i.user.id;

        if (sub === "add") {
            const item = i.options.getString("item").trim();
            if (item.length > MAX_ITEM_LENGTH) {
                return safeRespond(i, asEmbedPayload({
                    guildId: i.guild?.id, type: "error",
                    title: "❌ Too Long",
                    description: `Tasks must be **${MAX_ITEM_LENGTH}** characters or fewer.`,
                    ephemeral: true,
                }));
            }
            const count = await db.get("SELECT COUNT(*) AS c FROM todos WHERE user_id = ?", userId);
            if ((count?.c ?? 0) >= MAX_ITEMS) {
                return safeRespond(i, asEmbedPayload({
                    guildId: i.guild?.id, type: "error",
                    title: "❌ List Full",
                    description: `You can have up to **${MAX_ITEMS}** tasks. Remove some first.`,
                    ephemeral: true,
                }));
            }

            const result = await db.run("INSERT INTO todos (user_id, item, created_at) VALUES (?, ?, ?)", userId, item, Date.now());
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "success",
                title: "✅ Task Added",
                fields: [
                    { name: "📝 Task", value: item, inline: false },
                    { name: "🆔 ID", value: `\`${result.lastID}\``, inline: true },
                ],
                ephemeral: true,
            }));
        }

        if (sub === "list") {
            const rows = await db.all("SELECT id, item, created_at FROM todos WHERE user_id = ? ORDER BY created_at ASC", userId);
            if (!rows.length) {
                return safeRespond(i, asEmbedPayload({
                    guildId: i.guild?.id, type: "info",
                    title: "📝 To-Do List",
                    description: "Your to-do list is empty. Add one with `/todo add`.",
                    ephemeral: true,
                }));
            }
            const list = rows.map(r => `**\`#${r.id}\`** • ${r.item}\n   *added <t:${Math.floor(r.created_at / 1000)}:R>*`).join("\n\n").slice(0, 4000);

            const embed = buildCoolEmbed({
                guildId: i.guild?.id, type: "info",
                title: `📝 To-Do List — ${i.user.username}`,
                description: list,
                showAuthor: true,
                client: i.client,
            });

            embed.setFooter({
                text: `${rows.length}/${MAX_ITEMS} tasks • Use /todo remove <id> to delete`,
                iconURL: i.user.displayAvatarURL({ dynamic: true }),
            });

            return safeRespond(i, { embeds: [embed], ephemeral: true });
        }

        if (sub === "remove") {
            const id = i.options.getInteger("id");
            const row = await db.get("SELECT item FROM todos WHERE id = ? AND user_id = ?", id, userId);
            if (!row) {
                return safeRespond(i, asEmbedPayload({
                    guildId: i.guild?.id, type: "error",
                    title: "❌ Not Found",
                    description: `Task **#${id}** not found or doesn't belong to you.`,
                    ephemeral: true,
                }));
            }
            await db.run("DELETE FROM todos WHERE id = ? AND user_id = ?", id, userId);
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "success",
                title: "🗑️ Task Removed",
                description: `Removed: ~~${row.item}~~`,
                ephemeral: true,
            }));
        }

        if (sub === "clear") {
            const result = await db.run("DELETE FROM todos WHERE user_id = ?", userId);
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "success",
                title: "🧹 List Cleared",
                description: `Removed **${result.changes}** task(s) from your list.`,
                ephemeral: true,
            }));
        }
    }
};

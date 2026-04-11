import { safeRespond } from "../../utils/helpers.js";
import { buildCoolEmbed } from "../../utils/embeds.js";
import { getDB } from "../../utils/db.js";

export default {
    data: {
        name: "leaderboard", description: "Displays the top 10 users in the server based on XP"
    },
    async execute(i) {
        const db = getDB();
        const guildId = i.guild.id;

        const topUsers = db.prepare(
            "SELECT * FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10"
        ).all(guildId);

        if (topUsers.length === 0) {
            return safeRespond(i, {
                embeds: [
                    buildCoolEmbed({
                        guildId,
                        type: "info",
                        title: "🏆 Leaderboard",
                        description: "No one has earned any XP in this server yet!",
                    })
                ]
            });
        }

        const lines = await Promise.all(topUsers.map(async (data, index) => {
            let userTag = "Unknown User";
            try {
                const user = await i.client.users.fetch(data.user_id);
                userTag = user.tag;
            } catch {
                userTag = `ID: ${data.user_id}`;
            }

            const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
            return `**${medal} ${userTag}** — Level ${data.level} (${data.xp} XP)`;
        }));

        const embed = buildCoolEmbed({
            guildId,
            type: "info",
            title: `🏆 Leaderboard - ${i.guild.name}`,
            description: lines.join("\n"),
            footerUser: i.user
        });

        return safeRespond(i, { embeds: [embed] });
    }
};

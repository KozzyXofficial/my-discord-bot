import { safeRespond } from "../../utils/helpers.js";
import { buildCoolEmbed } from "../../utils/embeds.js";
import { getDB } from "../../utils/db.js";

export default {
    data: {
        name: "rank", description: "Displays your current level and XP", options: [
            { name: "user", description: "The user to check the rank of", type: 6, required: false }
        ]
    },
    async execute(i) {
        const user = i.options?.getUser?.("user") || i.user;
        const db = getDB();
        const guildId = i.guild.id;

        const userData = db.prepare("SELECT * FROM levels WHERE user_id = ? AND guild_id = ?").get(user.id, guildId);

        if (!userData) {
            return safeRespond(i, {
                embeds: [
                    buildCoolEmbed({
                        guildId,
                        type: "info",
                        title: "📈 Rank",
                        description: user.id === i.user.id
                            ? "You don't have any XP yet! Send some messages to earn some."
                            : `${user.username} hasn't earned any XP yet.`,
                    })
                ]
            });
        }

        const currentLevelXp = 100 * (userData.level * userData.level);
        const nextLevelXp = 100 * ((userData.level + 1) * (userData.level + 1));
        const xpInCurrentLevel = userData.xp - currentLevelXp;
        const xpNeededForNext = nextLevelXp - currentLevelXp;
        const progress = Math.min(Math.max(xpInCurrentLevel / xpNeededForNext, 0), 1);

        const progressBar = "■".repeat(Math.floor(progress * 10)) + "□".repeat(10 - Math.floor(progress * 10));

        const embedRegion = buildCoolEmbed({
            guildId,
            type: "info",
            title: `📈 Rank - ${user.username}`,
            fields: [
                { name: "Level", value: `**${userData.level}**`, inline: true },
                { name: "Total XP", value: `**${userData.xp}**`, inline: true },
                { name: "Progress", value: `\`${progressBar}\` (${Math.floor(progress * 100)}%)`, inline: false },
                { name: "Next Level", value: `**${userData.xp}** / **${nextLevelXp}** XP`, inline: false }
            ],
            footerUser: i.user
        });

        return safeRespond(i, { embeds: [embedRegion] });
    }
};

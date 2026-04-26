import { getWarningData } from "../../utils/database.js";
import { buildCoolEmbed } from "../../utils/embeds.js";

export default {
    name: "warnings",
    async execute(message, args) {
        const target = message.mentions.members.first() || message.member;
        const data = getWarningData(message.guild.id, target.id);

        if (data.count === 0 && (!data.history || data.history.length === 0)) {
            const embed = buildCoolEmbed({
                guildId: message.guild.id,
                type: "success",
                title: "✅ Clean Record",
                description: `${target} has no warnings.`,
                showAuthor: true,
                client: message.client,
            }).setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 128 }));
            return message.reply({ embeds: [embed] });
        }

        const recent = (data.history || [])
            .filter(h => h.action === "add")
            .slice(-10)
            .reverse();

        const lines = recent.map((h, idx) => {
            const ts = `<t:${Math.floor(h.at / 1000)}:R>`;
            const by = h.by ? `<@${h.by}>` : "_unknown_";
            const reason = h.reason ? ` — ${String(h.reason).slice(0, 80)}` : "";
            return `**${idx + 1}.** ${ts} by ${by}${reason}`;
        });

        const embed = buildCoolEmbed({
            guildId: message.guild.id,
            type: "warning",
            title: `⚠️ Warnings — ${target.user.tag}`,
            description: `**Active Warnings:** \`${data.count}\``,
            fields: lines.length
                ? [{ name: `📋 Recent History (last ${lines.length})`, value: lines.join("\n").slice(0, 1024), inline: false }]
                : [],
            showAuthor: true,
            client: message.client,
        }).setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 128 }));

        return message.reply({ embeds: [embed] });
    }
};

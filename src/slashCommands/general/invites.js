import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload, buildCoolEmbed } from "../../utils/embeds.js";
import { getInviteStats, getInvitedBy } from "../../utils/inviteTracker.js";
import { getGuildSettings } from "../../utils/database.js";

export default {
    data: {
        name: "invites",
        description: "Check invite stats for yourself or another user",
        dm_permission: false,
        options: [
            { name: "user", description: "User to check (defaults to you)", type: 6, required: false },
        ],
    },

    async execute(interaction) {
        if (!interaction.guildId) return;

        const settings = getGuildSettings(interaction.guildId);
        if (!settings.plugins?.invite_tracking) {
            return safeRespond(interaction, asEmbedPayload({
                guildId: interaction.guildId, type: "error",
                title: "❌ Plugin Disabled",
                description: "Invite tracking is not enabled. An admin can enable it with `/plugins enable invite_tracking`.",
                ephemeral: true,
            }));
        }

        const target = interaction.options.getUser("user") ?? interaction.user;
        const stats = await getInviteStats(interaction.guildId, target.id);
        const invitedBy = await getInvitedBy(interaction.guildId, target.id);

        const recentLines = stats.recent.length
            ? stats.recent.slice(0, 8).map(r => `• <@${r.user_id}> — <t:${Math.floor(r.joined_at / 1000)}:R>`).join("\n")
            : "_No recent invites._";

        const fields = [
            { name: "📊 Total Invites", value: `**${stats.total}**`, inline: true },
            { name: "👋 Invited By", value: invitedBy?.inviter_id ? `<@${invitedBy.inviter_id}>` : "_Unknown_", inline: true },
        ];

        if (stats.recent.length) {
            fields.push({ name: `🕐 Recent Invites [${Math.min(stats.recent.length, 8)}]`, value: recentLines, inline: false });
        }

        const embed = buildCoolEmbed({
            guildId: interaction.guildId,
            type: "info",
            title: `📨 Invites — ${target.username}`,
            fields,
            showAuthor: true,
            client: interaction.client,
        }).setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }));

        embed.setFooter({
            text: `Requested by ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        });

        return safeRespond(interaction, { embeds: [embed] });
    },
};

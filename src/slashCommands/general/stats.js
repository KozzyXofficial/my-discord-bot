import { safeRespond } from "../../utils/helpers.js";
import { buildCoolEmbed } from "../../utils/embeds.js";

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${sec}s`);
    return parts.join(" ");
}

function pingHealth(ms) {
    if (ms < 100) return "🟢 Excellent";
    if (ms < 200) return "🟡 Good";
    if (ms < 400) return "🟠 Fair";
    return "🔴 High";
}

export default {
    data: { name: "stats", description: "Show bot statistics & health" },

    async execute(interaction) {
        const { client } = interaction;
        const mem = process.memoryUsage();
        const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

        const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
        const totalChannels = client.channels.cache.size;
        const slashCount = client.slashCommands?.size ?? 0;
        const prefixCount = client.prefixCommands?.size ?? 0;
        const ping = client.ws.ping;

        const djsVersion = (await import("discord.js")).version;

        const embed = buildCoolEmbed({
            guildId: interaction.guildId,
            type: "info",
            client,
            title: `📊 ${client.user.username} Statistics`,
            fields: [
                {
                    name: "🌐 Reach",
                    value: `🏠 Servers: **${client.guilds.cache.size}**\n👥 Members: **${totalMembers.toLocaleString()}**\n📁 Channels: **${totalChannels.toLocaleString()}**`,
                    inline: true,
                },
                {
                    name: "⚙️ Commands",
                    value: `⚡ Slash: **${slashCount}**\n💬 Prefix: **${prefixCount}**\n📦 Total: **${slashCount + prefixCount}**`,
                    inline: true,
                },
                {
                    name: "📶 Health",
                    value: `🏓 Ping: **${ping}ms** ${pingHealth(ping)}\n⏱️ Uptime: **${formatUptime(client.uptime)}**`,
                    inline: false,
                },
                {
                    name: "💾 Memory",
                    value: `Heap: **${heapMB} MB**\nRSS: **${rssMB} MB**`,
                    inline: true,
                },
                {
                    name: "🔧 Runtime",
                    value: `Node: **${process.version}**\ndiscord.js: **v${djsVersion}**\nPlatform: \`${process.platform}\``,
                    inline: true,
                },
            ],
            showAuthor: true,
            showFooter: true,
            footerText: `Requested by ${interaction.user.tag}`,
        });

        if (client.user.displayAvatarURL) {
            embed.setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }));
        }

        return safeRespond(interaction, { embeds: [embed] });
    },
};

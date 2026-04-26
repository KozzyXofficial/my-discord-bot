import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload } from "../../utils/embeds.js";

function pingHealth(ms) {
    if (ms < 100) return "🟢 Excellent";
    if (ms < 200) return "🟡 Good";
    if (ms < 400) return "🟠 Fair";
    return "🔴 High";
}

export default {
    data: {
        name: "pong",
        description: "Check the bot's latency and connection health.",
    },

    async execute(interaction) {
        const sent = Date.now();
        await interaction.deferReply();
        const apiLatency = Date.now() - sent;
        const wsLatency = interaction.client.ws.ping;

        return safeRespond(interaction, asEmbedPayload({
            guildId: interaction.guildId,
            type: "info",
            title: "🏓 Pong!",
            fields: [
                { name: "🌐 WebSocket", value: `**${wsLatency}ms** ${pingHealth(wsLatency)}`, inline: true },
                { name: "⚡ API Roundtrip", value: `**${apiLatency}ms** ${pingHealth(apiLatency)}`, inline: true },
            ],
            footerUser: interaction.user,
            client: interaction.client,
        }));
    },
};

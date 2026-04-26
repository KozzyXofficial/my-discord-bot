import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload } from "../../utils/embeds.js";

export default {
    data: {
        name: "decide",
        description: "Pick between options for you",
        integration_types: [0, 1],
        contexts: [0, 1, 2],
        options: [
            { name: "options", description: "Comma separated options (e.g. Pizza, Sushi, Burger)", type: 3, required: true }
        ]
    },
    async execute(i) {
        const raw = i.options.getString("options");
        const list = [...new Set(raw.split(",").map(s => s.trim()).filter(Boolean))];

        if (list.length < 2) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id,
                type: "error",
                title: "❌ Need More Options",
                description: "Provide at least **two** unique options separated by commas.\nExample: `Pizza, Sushi, Burger`",
                ephemeral: true,
            }));
        }
        if (list.length > 25) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id,
                type: "error",
                title: "❌ Too Many Options",
                description: "Maximum **25** options at a time.",
                ephemeral: true,
            }));
        }

        const choice = list[Math.floor(Math.random() * list.length)];
        const optionsList = list
            .map((o, idx) => o === choice ? `**${idx + 1}. ${o}** ✅` : `${idx + 1}. ${o}`)
            .join("\n");

        return safeRespond(i, asEmbedPayload({
            guildId: i.guild?.id,
            type: "success",
            title: "🎲 I have decided...",
            description: `## ${choice}`,
            fields: [
                { name: `📝 Options [${list.length}]`, value: optionsList.slice(0, 1024), inline: false },
            ],
            footerUser: i.user,
            client: i.client,
        }));
    }
};

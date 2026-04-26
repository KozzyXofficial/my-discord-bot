import { safeRespond } from "../../utils/helpers.js";
import { asEmbedPayload, buildCoolEmbed } from "../../utils/embeds.js";

export default {
    data: {
        name: "define",
        description: "Look up the definition of an English word",
        options: [
            { name: "word", description: "The word to define", type: 3, required: true }
        ]
    },
    async execute(i) {
        const word = i.options?.getString?.("word")?.trim();
        if (!word) {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "error",
                title: "❌ Missing Word",
                description: "Provide a word to define.",
                ephemeral: true,
            }));
        }

        await i.deferReply();

        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (!res.ok) throw new Error("not_found");
            const data = await res.json();
            if (!Array.isArray(data) || !data[0]) throw new Error("no_data");

            const entry = data[0];
            const phonetic = entry.phonetic
                || entry.phonetics?.find(p => p.text)?.text
                || null;
            const audio = entry.phonetics?.find(p => p.audio)?.audio || null;

            const fields = [];
            for (const meaning of (entry.meanings || []).slice(0, 4)) {
                const defs = (meaning.definitions || []).slice(0, 2);
                if (!defs.length) continue;
                const value = defs.map((d, idx) => {
                    let line = `**${idx + 1}.** ${d.definition}`;
                    if (d.example) line += `\n   *e.g. "${d.example}"*`;
                    return line;
                }).join("\n").slice(0, 1024);
                fields.push({
                    name: `📖 ${meaning.partOfSpeech}`,
                    value,
                    inline: false,
                });
            }

            const synonyms = (entry.meanings || [])
                .flatMap(m => m.synonyms || [])
                .slice(0, 6);
            if (synonyms.length) {
                fields.push({ name: "🔁 Synonyms", value: synonyms.map(s => `\`${s}\``).join(", "), inline: false });
            }

            const embed = buildCoolEmbed({
                guildId: i.guild?.id,
                type: "info",
                title: `📚 ${entry.word}`,
                description: phonetic ? `*${phonetic}*` : null,
                fields,
                showAuthor: true,
                client: i.client,
            });

            if (entry.sourceUrls?.[0]) embed.setURL(entry.sourceUrls[0]);
            if (audio) embed.addFields({ name: "🔊 Audio", value: `[Listen](${audio.startsWith("http") ? audio : `https:${audio}`})`, inline: true });

            embed.setFooter({
                text: `Requested by ${i.user.tag}`,
                iconURL: i.user.displayAvatarURL({ dynamic: true }),
            });

            return safeRespond(i, { embeds: [embed] });
        } catch {
            return safeRespond(i, asEmbedPayload({
                guildId: i.guild?.id, type: "error",
                title: "❌ Not Found",
                description: `I couldn't find a definition for **${word}**. Check the spelling and try again.`,
                ephemeral: true,
            }));
        }
    }
};

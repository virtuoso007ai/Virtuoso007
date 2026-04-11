import * as fs from "fs";
import * as path from "path";
function normalizeAlias(s) {
    return s.trim().toLowerCase().replace(/^@/, "");
}
function parseAgentsJson(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("Agent JSON geçersiz");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Agent listesi boş veya dizi değil");
    }
    const map = new Map();
    for (const row of parsed) {
        if (!row || typeof row !== "object")
            continue;
        const alias = normalizeAlias(String(row.alias ?? ""));
        const apiKey = String(row.apiKey ?? "").trim();
        if (!alias || !apiKey)
            continue;
        if (map.has(alias))
            throw new Error(`Yinelenen alias: ${alias}`);
        const walletRaw = row.walletAddress?.trim();
        const hlWalletRaw = row.hlWallet?.trim();
        const autoRaw = row.autoTrade;
        const forumKeyRaw = row.forumApiKey?.trim();
        map.set(alias, {
            alias,
            apiKey,
            label: row.label?.trim(),
            walletAddress: walletRaw || undefined,
            hlWallet: hlWalletRaw || undefined,
            autoTrade: typeof autoRaw === "boolean" ? autoRaw : undefined,
            forumApiKey: forumKeyRaw || undefined,
        });
    }
    if (map.size === 0)
        throw new Error("Geçerli agent yok");
    return map;
}
/** Önce `AGENTS_JSON`, yoksa `AGENTS_JSON_PATH` dosyası (Railway / volume). */
export function loadAgents() {
    const inline = process.env.AGENTS_JSON?.trim();
    if (inline) {
        return parseAgentsJson(inline);
    }
    const filePath = process.env.AGENTS_JSON_PATH?.trim();
    if (filePath) {
        const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(abs)) {
            throw new Error(`AGENTS_JSON_PATH bulunamadı: ${abs}`);
        }
        return parseAgentsJson(fs.readFileSync(abs, "utf-8"));
    }
    throw new Error("AGENTS_JSON veya AGENTS_JSON_PATH gerekli. Örnek: agents.example.json kopyala, anahtarları doldur.");
}
export function getAgent(map, alias) {
    return map.get(normalizeAlias(alias));
}
/** HL subaccount cüzdanı — önce `hlWallet`, yoksa `walletAddress`. */
export function getHlWallet(agent) {
    return agent.hlWallet?.trim() || agent.walletAddress?.trim();
}

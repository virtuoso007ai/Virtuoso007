/**
 * Oturumdaki Virtuals hesabinin legacy agent listesini JSON yazdirir.
 * Kullanim (repo kokunden): npx tsx scripts/dump-legacy-agents.ts
 */
import { getClient } from "../vendor/acp-cli/src/lib/api/client.ts";

async function main() {
  const { agentApi } = await getClient();
  const list = await agentApi.getLegacyAgents();
  console.log(JSON.stringify(list, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

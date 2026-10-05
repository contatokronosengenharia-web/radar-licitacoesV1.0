import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { criteriosSchema } from "@/filtros/criterios";
import { compilarCondicao } from "@/filtros/motor";
import { gravarContratacoes } from "@/pncp/gravar";
import type { ContratacaoPncp } from "@/pncp/tipos";
import { limparBanco } from "./util";

const REAIS: ContratacaoPncp[] = JSON.parse(
  readFileSync(new URL("./fixtures/publicacao-pregao.json", import.meta.url), "utf8"),
);
// Antes do encerramento das propostas das três contratações do arquivo.
const AGORA = new Date("2026-10-06T12:00:00Z");

async function casa(criterios: unknown, agora = AGORA): Promise<string[]> {
  const c = criteriosSchema.parse(criterios);
  const r = await db.execute<{ n: string }>(
    sql`select c.numero_controle_pncp as n from contratacao c where ${compilarCondicao(c, agora)} order by 1`,
  );
  return r.rows.map((x) => x.n);
}

const MONITORAMENTO = "88124961000159-1-000114/2026";
const MATERIAIS = "87612818000143-1-000466/2026";
const NOBREAK = "06015041000138-1-000065/2026";

describe("motor de filtros", () => {
  beforeAll(async () => {
    await limparBanco();
    await gravarContratacoes(db, REAIS);
  });

  it("perfil vazio aceita tudo", async () => {
    expect(await casa({})).toHaveLength(3);
  });
  it("palavra-chave ignora acento, maiúsculas e plural", async () => {
    expect(await casa({ palavras: { incluir: ["eletronico"] } })).toEqual([MONITORAMENTO]);
    expect(await casa({ palavras: { incluir: ["material educativo"] } })).toEqual([MATERIAIS]);
    expect(await casa({ palavras: { incluir: ["monitoramento", "no-break"] } })).toEqual([NOBREAK, MONITORAMENTO]);
    expect(await casa({ palavras: { incluir: ["equipamento"] } })).toEqual([NOBREAK]);
    expect(await casa({ palavras: { incluir: ["assistencia social"] } })).toEqual([MATERIAIS]);
  });
  it("expressão entre aspas exige a frase", async () => {
    expect(await casa({ palavras: { incluir: ['"materiais educativos"'] } })).toEqual([MATERIAIS]);
    expect(await casa({ palavras: { incluir: ['"educativos materiais"'] } })).toEqual([]);
  });
  it("palavra de exclusão descarta", async () => {
    expect(await casa({ palavras: { excluir: ["registro"] } })).toEqual([MATERIAIS, MONITORAMENTO]);
  });
  it("filtros de lista combinam com E entre critérios e OU dentro do critério", async () => {
    expect(await casa({ ufs: ["RS", "AL"], esferas: ["F"] })).toEqual([NOBREAK]);
    expect(await casa({ modosDisputa: [3] })).toEqual([NOBREAK, MATERIAIS]);
    expect(await casa({ municipios: ["4317103"] })).toEqual([MONITORAMENTO]);
    expect(await casa({ unidades: ["06015041000138:070011"] })).toEqual([NOBREAK]);
    expect(await casa({ fontesOrcamentarias: [4] })).toEqual([NOBREAK]);
    expect(await casa({ srp: true })).toEqual([NOBREAK]);
  });
  it("faixa de valor estimado", async () => {
    expect(await casa({ valor: { min: 200000, max: 500000 } })).toEqual([NOBREAK]);
  });
  it("status recebendo propostas depende da data de encerramento", async () => {
    expect(await casa({ status: ["recebendo_propostas"] })).toHaveLength(3);
    const depois = new Date("2026-10-20T12:00:00Z");
    expect(await casa({ status: ["recebendo_propostas"] }, depois)).toEqual([NOBREAK]);
    expect(await casa({ status: ["propostas_encerradas"] }, depois)).toEqual([MATERIAIS, MONITORAMENTO]);
  });
  it("prazo mínimo para proposta", async () => {
    expect(await casa({ prazoMinimoDias: 14 })).toEqual([NOBREAK]);
  });
});

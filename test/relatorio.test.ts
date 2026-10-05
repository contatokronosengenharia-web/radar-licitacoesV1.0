import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as cronRelatorios } from "@/app/api/cron/gerar-relatorios/route";
import { proximoRelatorio } from "@/contas/horario";
import { db } from "@/db";
import { empresa, entrega, oportunidade, perfilFiltro, relatorio, relatorioItem } from "@/db/schema";
import { criteriosSchema } from "@/filtros/criterios";
import { processarLote } from "@/filtros/motor";
import { gravarContratacoes } from "@/pncp/gravar";
import type { ContratacaoPncp } from "@/pncp/tipos";
import { gerarRelatorioEmpresa, gerarRelatoriosDevidos } from "@/relatorios/gerar";
import { montarTextoRelatorio } from "@/relatorios/mensagem";
import { limparBanco } from "./util";

const REAIS: ContratacaoPncp[] = JSON.parse(
  readFileSync(new URL("./fixtures/publicacao-pregao.json", import.meta.url), "utf8"),
);
const MONITORAMENTO = "88124961000159-1-000114/2026";
const NOBREAK = "06015041000138-1-000065/2026";

// Segunda, 06/10/2026, 00:00 UTC (21:00 de domingo em Brasília). Todas as propostas do
// arquivo ainda estão abertas nesta data.
const BASE = new Date("2026-10-06T00:00:00Z");
const em = (iso: string) => new Date(iso);

let cnpjSeq = 0;
async function novaEmpresa(hora: string, fuso: string, criterios: unknown, desde = BASE) {
  cnpjSeq++;
  const [e] = await db
    .insert(empresa)
    .values({
      razaoSocial: `Empresa ${hora} ${fuso}`,
      cnpj: String(cnpjSeq).padStart(14, "0"),
      horaRelatorio: hora,
      fusoHorario: fuso,
      proximoRelatorioEm: proximoRelatorio(hora, fuso, desde),
      criadoEm: new Date(desde.getTime() - 86_400_000),
    })
    .returning();
  const [p] = await db
    .insert(perfilFiltro)
    .values({ empresaId: e.id, criterios: criteriosSchema.parse(criterios) })
    .returning();
  return { ...e, perfilId: p.id };
}

/** Coleta simulada: grava as contratações e roda o motor, como o pipeline faz. */
async function coletarERodarMotor(registros: ContratacaoPncp[], encontradaEm: Date) {
  await gravarContratacoes(db, registros);
  await processarLote(db, encontradaEm);
  await db.execute(sql`update oportunidade set encontrada_em = ${encontradaEm} where relatorio_id is null and encontrada_em > ${encontradaEm}`);
}

async function itensDoRelatorio(relatorioId: number) {
  const r = await db.execute<{ n: string }>(sql`
    select resumo ->> 'numeroControlePncp' as n from relatorio_item where relatorio_id = ${relatorioId} order by posicao`);
  return r.rows.map((x) => x.n);
}

describe("horário e fuso do relatório", () => {
  it("converte o horário local de cada empresa para UTC", () => {
    const agora = em("2026-10-06T12:00:00Z"); // 09:00 em Brasília
    expect(proximoRelatorio("08:30", "America/Sao_Paulo", agora)).toEqual(em("2026-10-07T11:30:00Z"));
    expect(proximoRelatorio("10:00", "America/Sao_Paulo", agora)).toEqual(em("2026-10-06T13:00:00Z"));
    expect(proximoRelatorio("18:00", "America/Manaus", agora)).toEqual(em("2026-10-06T22:00:00Z"));
    expect(proximoRelatorio("07:00", "America/Rio_Branco", agora)).toEqual(em("2026-10-07T12:00:00Z"));
    // 09:00 em Noronha (UTC−2) = 11:00 UTC, que já passou: vai para o dia seguinte.
    expect(proximoRelatorio("09:00", "America/Noronha", agora)).toEqual(em("2026-10-07T11:00:00Z"));
    // 22:00 em Brasília já é o dia seguinte em UTC.
    expect(proximoRelatorio("22:00", "America/Sao_Paulo", agora)).toEqual(em("2026-10-07T01:00:00Z"));
  });

  it("o horário exato não gera o mesmo relatório de novo: o próximo é o do dia seguinte", () => {
    const agora = em("2026-10-06T13:00:00Z"); // exatamente 10:00 em Brasília
    expect(proximoRelatorio("10:00", "America/Sao_Paulo", agora)).toEqual(em("2026-10-07T13:00:00Z"));
  });
});

describe("geração do relatório", () => {
  beforeEach(limparBanco);

  it("cada empresa recebe no seu horário, sem consultar o PNCP", async () => {
    const chamadas: string[] = [];
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (async (u: string) => {
      chamadas.push(String(u));
      throw new Error("o relatório não pode consultar o PNCP");
    }) as typeof fetch;
    try {
      const a = await novaEmpresa("08:30", "America/Sao_Paulo", {});
      const b = await novaEmpresa("10:00", "America/Sao_Paulo", {});
      const c = await novaEmpresa("18:00", "America/Manaus", {});
      await coletarERodarMotor(REAIS, em("2026-10-06T10:00:00Z"));

      // 08:35 em Brasília: só a empresa A.
      const r1 = await gerarRelatoriosDevidos(db, em("2026-10-06T11:35:00Z"));
      expect(r1.gerados).toBe(1);
      // 10:01 em Brasília: só a B (A já foi).
      const r2 = await gerarRelatoriosDevidos(db, em("2026-10-06T13:01:00Z"));
      expect(r2.gerados).toBe(1);
      // 17:59 em Manaus (21:59 UTC): C ainda não.
      expect((await gerarRelatoriosDevidos(db, em("2026-10-06T21:59:00Z"))).gerados).toBe(0);
      // 18:00 em Manaus.
      expect((await gerarRelatoriosDevidos(db, em("2026-10-06T22:00:00Z"))).gerados).toBe(1);

      const linhas = await db.select().from(relatorio).orderBy(relatorio.id);
      expect(linhas.map((l) => [l.empresaId, l.agendadoPara.toISOString(), l.total])).toEqual([
        [a.id, "2026-10-06T11:30:00.000Z", 3],
        [b.id, "2026-10-06T13:00:00.000Z", 3],
        [c.id, "2026-10-06T22:00:00.000Z", 3],
      ]);
      expect(linhas[2].fusoHorario).toBe("America/Manaus");

      const [ea] = await db.select().from(empresa).where(eq(empresa.id, a.id));
      expect(ea.proximoRelatorioEm).toEqual(em("2026-10-07T11:30:00Z"));
      expect(chamadas).toEqual([]);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });

  it("registra relatório, itens com retrato do conteúdo e entrega no painel", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", { palavras: { incluir: ["monitoramento", "no-break"] } });
    await coletarERodarMotor(REAIS, em("2026-10-06T09:00:00Z"));

    const r = await gerarRelatorioEmpresa(db, e.id, em("2026-10-06T11:00:00Z"));
    expect(r).toMatchObject({ gerado: true, total: 2, excluidas: 0 });
    if (!r.gerado) return;

    // Ordem: o prazo de propostas que acaba primeiro vem antes.
    expect(await itensDoRelatorio(r.relatorioId)).toEqual([MONITORAMENTO, NOBREAK]);
    const [item] = await db.select().from(relatorioItem).where(eq(relatorioItem.posicao, 1));
    expect(item.resumo).toMatchObject({
      orgao: "MUNICIPIO DE SANTANA DO LIVRAMENTO",
      uf: "RS",
      linkPncp: "https://pncp.gov.br/app/editais/88124961000159/2026/114",
    });
    expect(item.perfilId).toBe(e.perfilId);

    const ops = await db.select().from(oportunidade).where(eq(oportunidade.empresaId, e.id));
    expect(ops.every((o) => o.relatorioId === r.relatorioId)).toBe(true);

    const entregas = await db.select().from(entrega);
    expect(entregas.map((x) => [x.canal, x.situacao])).toEqual([["painel", "entregue"]]);

    const [rel] = await db.select().from(relatorio);
    expect(rel.periodoInicio).toEqual(em("2026-10-05T00:00:00Z"));
    expect(rel.perfis).toEqual([{ perfilId: e.perfilId, versao: 1 }]);
  });

  it("só entra o que é novo desde o último relatório; nada é enviado duas vezes", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", {});
    await coletarERodarMotor(REAIS.slice(0, 2), em("2026-10-06T09:00:00Z"));
    const r1 = await gerarRelatorioEmpresa(db, e.id, em("2026-10-06T11:00:00Z"));
    expect(r1).toMatchObject({ gerado: true, total: 2 });

    // A coleta seguinte traz de novo as mesmas duas (duplicadas) e uma nova.
    await coletarERodarMotor(REAIS, em("2026-10-06T20:00:00Z"));
    const r2 = await gerarRelatorioEmpresa(db, e.id, em("2026-10-07T11:00:00Z"));
    expect(r2).toMatchObject({ gerado: true, total: 1 });
    if (!r2.gerado) return;
    expect(await itensDoRelatorio(r2.relatorioId)).toEqual([NOBREAK]);

    // Sem nada novo, o relatório sai vazio (e fica registrado).
    const r3 = await gerarRelatorioEmpresa(db, e.id, em("2026-10-08T11:00:00Z"));
    expect(r3).toMatchObject({ gerado: true, total: 0 });

    const total = await db.execute<{ n: number; distintos: number }>(sql`
      select count(*)::int as n, count(distinct oportunidade_id)::int as distintos from relatorio_item`);
    expect(total.rows[0]).toEqual({ n: 3, distintos: 3 });
    const [rels] = (await db.execute<{ inicio: string; fim_anterior: string }>(sql`
      select to_json(r2.periodo_inicio) #>> '{}' as inicio, to_json(r1.periodo_fim) #>> '{}' as fim_anterior
      from relatorio r1 join relatorio r2 on r2.id = r1.id + 1 where r1.id = 1`)).rows;
    expect(new Date(rels.inicio)).toEqual(new Date(rels.fim_anterior));
  });

  it("o mesmo horário nunca gera dois relatórios, nem com execuções simultâneas", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", {});
    await coletarERodarMotor(REAIS, em("2026-10-06T09:00:00Z"));
    const agora = em("2026-10-06T11:00:00Z");

    const paralelas = await Promise.all([1, 2, 3].map(() => gerarRelatoriosDevidos(db, agora)));
    expect(paralelas.reduce((s, p) => s + p.gerados, 0)).toBe(1);

    // Mesmo que o próximo horário volte para trás (ex.: restauração), o relatório não se repete.
    await db.update(empresa).set({ proximoRelatorioEm: em("2026-10-06T11:00:00Z") }).where(eq(empresa.id, e.id));
    expect(await gerarRelatorioEmpresa(db, e.id, agora)).toMatchObject({ gerado: false, motivo: "ja_gerado" });
    expect(await db.$count(relatorio)).toBe(1);
    expect(await db.$count(relatorioItem)).toBe(3);
    const [depois] = await db.select().from(empresa).where(eq(empresa.id, e.id));
    expect(depois.proximoRelatorioEm).toEqual(em("2026-10-07T11:00:00Z"));
  });

  it("antes do horário não gera nada", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", {});
    expect(await gerarRelatorioEmpresa(db, e.id, em("2026-10-06T10:59:00Z"))).toMatchObject({ gerado: false, motivo: "nao_devido" });
    expect(await db.$count(relatorio)).toBe(0);
  });

  it("reaplica os filtros ativos na hora do relatório", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", { status: ["recebendo_propostas"] });
    await coletarERodarMotor(REAIS, em("2026-10-06T09:00:00Z"));

    // Depois de encontradas: a empresa muda o filtro para só RS e descarta uma delas.
    await db
      .update(perfilFiltro)
      .set({ criterios: criteriosSchema.parse({ status: ["recebendo_propostas"], ufs: ["RS"] }), versao: 2 })
      .where(eq(perfilFiltro.id, e.perfilId));
    await db.execute(sql`update oportunidade set marcacao = 'descartada' where contratacao_id =
      (select id from contratacao where numero_controle_pncp = ${MONITORAMENTO})`);

    const r = await gerarRelatorioEmpresa(db, e.id, em("2026-10-06T11:00:00Z"));
    expect(r).toMatchObject({ gerado: true, total: 1, excluidas: 2 });
    if (!r.gerado) return;
    expect(await itensDoRelatorio(r.relatorioId)).toEqual(["87612818000143-1-000466/2026"]);
    const [rel] = await db.select().from(relatorio);
    expect(rel.perfis).toEqual([{ perfilId: e.perfilId, versao: 2 }]);

    // Excluídas não voltam num relatório futuro, mesmo que o filtro seja desfeito.
    await db.update(perfilFiltro).set({ criterios: criteriosSchema.parse({}) }).where(eq(perfilFiltro.id, e.perfilId));
    expect(await gerarRelatorioEmpresa(db, e.id, em("2026-10-07T11:00:00Z"))).toMatchObject({ gerado: true, total: 0 });
  });

  it("prazo de propostas encerrado até a hora do relatório tira a oportunidade", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", { status: ["recebendo_propostas"] }, em("2026-10-19T00:00:00Z"));
    await coletarERodarMotor(REAIS, em("2026-10-18T09:00:00Z"));
    // Relatório de 20/10: monitoramento (19/10 09:00) e materiais (19/10 08:30) já encerraram;
    // só o no-break (21/10) segue recebendo propostas.
    await db.update(empresa).set({ proximoRelatorioEm: em("2026-10-20T11:00:00Z") }).where(eq(empresa.id, e.id));
    const r = await gerarRelatorioEmpresa(db, e.id, em("2026-10-20T11:00:00Z"));
    expect(r).toMatchObject({ gerado: true, total: 1, excluidas: 2 });
  });

  it("se o sistema ficou parado, gera um único relatório e agenda o próximo horário futuro", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", {});
    await coletarERodarMotor(REAIS, em("2026-10-06T09:00:00Z"));
    const r = await gerarRelatoriosDevidos(db, em("2026-10-09T15:00:00Z")); // três dias depois, 12:00 em Brasília
    expect(r.gerados).toBe(1);
    const [depois] = await db.select().from(empresa).where(eq(empresa.id, e.id));
    expect(depois.proximoRelatorioEm).toEqual(em("2026-10-10T11:00:00Z"));
  });

  it("empresa inativa não recebe relatório", async () => {
    const e = await novaEmpresa("08:00", "America/Sao_Paulo", {});
    await db.update(empresa).set({ ativa: false }).where(eq(empresa.id, e.id));
    expect((await gerarRelatoriosDevidos(db, em("2026-10-06T12:00:00Z"))).gerados).toBe(0);
  });
});

describe("rota de cron dos relatórios", () => {
  beforeEach(limparBanco);

  it("exige o CRON_SECRET", async () => {
    const sem = await cronRelatorios(new Request("http://x/api/cron/gerar-relatorios"));
    expect(sem.status).toBe(401);
    const errado = await cronRelatorios(
      new Request("http://x/api/cron/gerar-relatorios", { headers: { authorization: "Bearer outro" } }),
    );
    expect(errado.status).toBe(401);
    const certo = await cronRelatorios(
      new Request("http://x/api/cron/gerar-relatorios", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }),
    );
    expect(certo.status).toBe(200);
    expect(await certo.json()).toMatchObject({ gerados: 0, falhas: 0 });
  });
});

describe("texto do relatório (base para o WhatsApp)", () => {
  it("monta a mensagem a partir do retrato salvo", () => {
    const texto = montarTextoRelatorio({
      geradoEm: em("2026-10-06T11:30:00Z"),
      fusoHorario: "America/Sao_Paulo",
      itens: [
        {
          numeroControlePncp: MONITORAMENTO,
          objeto: "Monitoramento eletrônico",
          orgao: "MUNICIPIO DE SANTANA DO LIVRAMENTO",
          municipio: "Sant'Ana do Livramento",
          uf: "RS",
          modalidade: "Pregão - Eletrônico",
          valorEstimado: 858240,
          encerramentoPropostas: "2026-10-19T12:00:00+00:00",
          linkPncp: "https://pncp.gov.br/app/editais/88124961000159/2026/114",
        },
      ],
    });
    expect(texto).toContain("06/10/2026, 08:30");
    expect(texto).toContain("1 oportunidade nova");
    expect(texto).toMatch(/R\$\s858\.240,00/);
    expect(texto).toContain("propostas até 19/10/2026, 09:00");
    expect(montarTextoRelatorio({ geradoEm: BASE, fusoHorario: "America/Sao_Paulo", itens: [] })).toContain(
      "Nenhuma oportunidade nova",
    );
  });
});

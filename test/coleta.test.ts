import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { iniciarColeta } from "@/coleta/coleta";
import { db } from "@/db";
import { coletaControle, coletaExecucao, contratacao, dominio, empresa, oportunidade, perfilFiltro } from "@/db/schema";
import { executarFila } from "@/fila/manipuladores";
import { criteriosSchema } from "@/filtros/criterios";
import { hojeBrasilia } from "@/pncp/datas";
import { gravarContratacoes } from "@/pncp/gravar";
import type { ContratacaoPncp } from "@/pncp/tipos";
import { limparBanco, pagina, pncpFalso } from "./util";

const REAIS: ContratacaoPncp[] = JSON.parse(
  readFileSync(new URL("./fixtures/publicacao-pregao.json", import.meta.url), "utf8"),
);

async function modalidades(...codigos: number[]) {
  await db.insert(dominio).values(codigos.map((c) => ({ tipo: "modalidade", codigo: String(c), nome: `M${c}`, origem: "api_pncp" })));
}

async function empresaComPerfil(cnpj: string, criterios: unknown) {
  const [e] = await db.insert(empresa).values({ razaoSocial: `Empresa ${cnpj}`, cnpj }).returning();
  await db.insert(perfilFiltro).values({ empresaId: e.id, criterios: criteriosSchema.parse(criterios) });
  return e;
}

describe("gravação com deduplicação", () => {
  beforeEach(limparBanco);

  it("conta novos, duplicados e atualizados pelo numeroControlePNCP", async () => {
    const primeira = await gravarContratacoes(db, REAIS);
    expect(primeira).toEqual({ recebidos: 3, novos: 3, atualizados: 0, duplicados: 0 });

    const repetida = await gravarContratacoes(db, [...REAIS, REAIS[0]]);
    expect(repetida).toEqual({ recebidos: 4, novos: 0, atualizados: 0, duplicados: 4 });

    const revogada = { ...REAIS[1], situacaoCompraId: 2, situacaoCompraNome: "Revogada" };
    const mudou = await gravarContratacoes(db, [revogada]);
    expect(mudou).toEqual({ recebidos: 1, novos: 0, atualizados: 1, duplicados: 0 });

    const linhas = await db.select().from(contratacao);
    expect(linhas).toHaveLength(3);
    const atualizada = linhas.find((l) => l.numeroControlePncp === REAIS[1].numeroControlePNCP)!;
    expect(atualizada.situacaoId).toBe(2);
  });

  it("registra órgãos, municípios e códigos de domínio não documentados", async () => {
    await gravarContratacoes(db, REAIS);
    const poderes = await db.select().from(dominio).where(eq(dominio.tipo, "poder"));
    // "N" aparece nos dados reais do PNCP e não está no manual.
    expect(poderes.map((p) => [p.codigo, p.origem])).toContainEqual(["N", "descoberto"]);
    const r = await db.execute<{ n: number }>(sql`select count(*)::int as n from municipio`);
    expect(r.rows[0].n).toBe(3);
  });
});

describe("coleta centralizada", () => {
  let falso: ReturnType<typeof pncpFalso> | undefined;
  beforeEach(limparBanco);
  afterEach(() => falso?.restaurar());

  it("coleta páginas, fecha a execução, avança a marca e roda o motor", async () => {
    await modalidades(6, 8);
    const empresaA = await empresaComPerfil("11111111000191", { palavras: { incluir: ["monitoramento"] } });
    const empresaB = await empresaComPerfil("22222222000191", { ufs: ["AL"] });

    const hoje = hojeBrasilia();
    falso = pncpFalso((url) => {
      const mod = url.searchParams.get("codigoModalidadeContratacao");
      const pag = Number(url.searchParams.get("pagina"));
      if (mod !== "6" || url.searchParams.get("dataInicial") !== hoje.replaceAll("-", "")) return { status: 204 };
      return pag === 1 ? { status: 200, corpo: pagina(REAIS.slice(0, 2), 1, 2) } : { status: 200, corpo: pagina(REAIS.slice(2), 2, 2) };
    });

    const inicio = await iniciarColeta(db, "publicacao", "teste");
    expect(inicio.iniciada).toBe(true);
    // Uma segunda chamada não abre outra coleta em paralelo.
    expect((await iniciarColeta(db, "publicacao", "teste")).iniciada).toBe(false);

    await executarFila(db, 30_000);

    const [execucao] = await db.select().from(coletaExecucao);
    expect(execucao.situacao).toBe("sucesso");
    expect(execucao.registrosRecebidos).toBe(3);
    expect(execucao.registrosNovos).toBe(3);
    expect(execucao.erros).toBe(0);
    expect(execucao.duracaoMs).not.toBeNull();
    // Nunca uma chamada por empresa: só dia × modalidade × página.
    expect(falso.chamadas.every((u) => u.pathname.endsWith("/v1/contratacoes/publicacao"))).toBe(true);
    expect(falso.chamadas.every((u) => u.searchParams.get("tamanhoPagina") === "50")).toBe(true);

    const [controle] = await db.select().from(coletaControle);
    expect(controle.ultimaSucessoJanelaFim).toBe(hoje);

    const opsA = await db.select().from(oportunidade).where(eq(oportunidade.empresaId, empresaA.id));
    const opsB = await db.select().from(oportunidade).where(eq(oportunidade.empresaId, empresaB.id));
    expect(opsA).toHaveLength(1);
    expect(opsB).toHaveLength(1);

    // Nova coleta relê o dia: tudo é duplicado e nenhuma oportunidade se repete.
    await iniciarColeta(db, "publicacao", "teste");
    await executarFila(db, 30_000);
    const execucoes = await db.select().from(coletaExecucao).orderBy(coletaExecucao.id);
    expect(execucoes[1].situacao).toBe("sucesso");
    expect(execucoes[1].registrosDuplicados).toBe(3);
    expect(execucoes[1].registrosNovos).toBe(0);
    const total = await db.execute<{ n: number }>(sql`select count(*)::int as n from oportunidade`);
    expect(total.rows[0].n).toBe(2);
  });

  it("falha não avança a marca e a próxima coleta recupera o período", async () => {
    await modalidades(6);
    await db.insert(coletaControle).values({ tipo: "publicacao", ultimaSucessoJanelaFim: hojeBrasilia() });
    falso = pncpFalso(() => ({ status: 500, corpo: { erro: "fora do ar" } }));

    await iniciarColeta(db, "publicacao", "teste");
    // Força as novas tentativas a vencerem já, simulando o passar do tempo.
    for (let i = 0; i < 6; i++) {
      await db.execute(sql`update tarefa set executar_apos = now() where situacao = 'pendente'`);
      await executarFila(db, 5_000);
    }
    const [falhou] = await db.select().from(coletaExecucao);
    expect(falhou.situacao).toBe("falha");
    expect(falhou.erros).toBe(1);

    falso.restaurar();
    falso = pncpFalso(() => ({ status: 200, corpo: pagina(REAIS, 1, 1) }));
    const nova = await iniciarColeta(db, "publicacao", "teste");
    expect(nova.iniciada && nova.janela.inicio).toBe(hojeBrasilia());
    await executarFila(db, 30_000);
    const execucoes = await db.select().from(coletaExecucao).orderBy(coletaExecucao.id);
    expect(execucoes[1].situacao).toBe("sucesso");
    expect(execucoes[1].registrosNovos).toBe(3);
  });
});

import { createHash } from "node:crypto";
import { getTableColumns, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { contratacao, dominio, municipio, orgao, unidadeOrgao } from "@/db/schema";
import { parseDataPncp } from "./datas";
import type { ContratacaoPncp } from "./tipos";

export interface ContagemGravacao {
  recebidos: number;
  novos: number;
  atualizados: number;
  duplicados: number;
}

const texto = (v: string | null | undefined) => (v == null || v === "" ? null : v);

export function hashPayload(r: ContratacaoPncp): string {
  return createHash("sha256").update(JSON.stringify(r)).digest("hex");
}

export function normalizarContratacao(r: ContratacaoPncp) {
  const u = r.unidadeOrgao;
  return {
    numeroControlePncp: r.numeroControlePNCP,
    orgaoCnpj: r.orgaoEntidade.cnpj,
    anoCompra: r.anoCompra,
    sequencialCompra: r.sequencialCompra,
    numeroCompra: texto(r.numeroCompra),
    processo: texto(r.processo),
    orgaoRazaoSocial: texto(r.orgaoEntidade.razaoSocial),
    esferaId: texto(r.orgaoEntidade.esferaId),
    poderId: texto(r.orgaoEntidade.poderId),
    codigoUnidade: texto(u?.codigoUnidade),
    nomeUnidade: texto(u?.nomeUnidade),
    ufSigla: texto(u?.ufSigla),
    codigoIbge: texto(u?.codigoIbge),
    municipioNome: texto(u?.municipioNome),
    modalidadeId: r.modalidadeId ?? null,
    modoDisputaId: r.modoDisputaId ?? null,
    instrumentoConvocatorioId: r.tipoInstrumentoConvocatorioCodigo ?? null,
    amparoLegalCodigo: r.amparoLegal?.codigo ?? null,
    situacaoId: r.situacaoCompraId ?? null,
    objetoCompra: texto(r.objetoCompra),
    informacaoComplementar: texto(r.informacaoComplementar),
    valorTotalEstimado: r.valorTotalEstimado ?? null,
    valorTotalHomologado: r.valorTotalHomologado ?? null,
    orcamentoSigiloso: texto(r.indicadorOrcamentoSigiloso),
    srp: r.srp ?? null,
    fontesOrcamentarias: (r.fontesOrcamentarias ?? []).map((f) => f.codigo),
    dataPublicacaoPncp: parseDataPncp(r.dataPublicacaoPncp),
    dataAberturaProposta: parseDataPncp(r.dataAberturaProposta),
    dataEncerramentoProposta: parseDataPncp(r.dataEncerramentoProposta),
    dataInclusao: parseDataPncp(r.dataInclusao),
    dataAtualizacao: parseDataPncp(r.dataAtualizacao),
    dataAtualizacaoGlobal: parseDataPncp(r.dataAtualizacaoGlobal),
    linkSistemaOrigem: texto(r.linkSistemaOrigem),
    linkProcessoEletronico: texto(r.linkProcessoEletronico),
    payload: r,
    payloadHash: hashPayload(r),
  };
}

// Nunca mudam numa atualização: id, numero_controle_pncp, primeira_coleta_em, motor_processado_em.
const NAO_ATUALIZAVEIS = new Set(["id", "numeroControlePncp", "primeiraColetaEm", "motorProcessadoEm"]);
const SET_ATUALIZACAO = Object.fromEntries(
  Object.entries(getTableColumns(contratacao))
    .filter(([chave]) => !NAO_ATUALIZAVEIS.has(chave))
    .map(([chave, coluna]) => [chave, sql.raw(`excluded.${coluna.name}`)]),
);

/**
 * Grava uma página de contratações com deduplicação pelo numeroControlePNCP:
 * - não existia → insere (novo), e só então ela fica pendente para o motor de filtros;
 * - existia com conteúdo diferente → atualiza (atualizado), sem voltar para o motor;
 * - existia igual, ou repetida na mesma página → nada muda (duplicado).
 */
export async function gravarContratacoes(db: Db, registros: ContratacaoPncp[]): Promise<ContagemGravacao> {
  const recebidos = registros.length;
  if (recebidos === 0) return { recebidos, novos: 0, atualizados: 0, duplicados: 0 };

  const porNumero = new Map<string, ContratacaoPncp>();
  for (const r of registros) porNumero.set(r.numeroControlePNCP, r);
  const unicos = [...porNumero.values()];
  const agora = new Date();

  const linhas = unicos.map((r) => {
    const n = normalizarContratacao(r);
    const textoBusca = `${n.objetoCompra ?? ""} ${n.informacaoComplementar ?? ""}`;
    return {
      ...n,
      busca: sql`to_tsvector('portuguese', radar_unaccent(${textoBusca}))`,
      primeiraColetaEm: agora,
      ultimaColetaEm: agora,
    };
  });

  const gravadas = await db.transaction(async (tx) => {
    await gravarCadastrosAuxiliares(tx as unknown as Db, unicos);
    return tx
      .insert(contratacao)
      .values(linhas)
      .onConflictDoUpdate({
        target: contratacao.numeroControlePncp,
        set: SET_ATUALIZACAO,
        setWhere: sql`${contratacao.payloadHash} <> excluded.payload_hash`,
      })
      .returning({ id: contratacao.id, inserida: sql<boolean>`(xmax = 0)` });
  });

  const novos = gravadas.filter((g) => g.inserida).length;
  const atualizados = gravadas.length - novos;
  return { recebidos, novos, atualizados, duplicados: recebidos - novos - atualizados };
}

/** Órgãos, unidades, municípios e códigos de domínio desconhecidos, a partir dos próprios dados. */
async function gravarCadastrosAuxiliares(db: Db, registros: ContratacaoPncp[]) {
  const orgaos = new Map<string, typeof orgao.$inferInsert>();
  const unidades = new Map<string, typeof unidadeOrgao.$inferInsert>();
  const municipios = new Map<string, typeof municipio.$inferInsert>();
  const dominios = new Map<string, typeof dominio.$inferInsert>();
  const descoberto = (tipo: string, codigo: unknown, nome: string | null | undefined) => {
    if (codigo == null || codigo === "") return;
    const c = String(codigo);
    dominios.set(`${tipo}:${c}`, {
      tipo,
      codigo: c,
      nome: nome?.trim() || `Código ${c} (não documentado)`,
      origem: "descoberto",
    });
  };

  for (const r of registros) {
    const o = r.orgaoEntidade;
    orgaos.set(o.cnpj, {
      cnpj: o.cnpj,
      razaoSocial: o.razaoSocial,
      esferaId: o.esferaId,
      poderId: o.poderId,
      atualizadoEm: new Date(),
    });
    const u = r.unidadeOrgao;
    if (u?.codigoUnidade) {
      unidades.set(`${o.cnpj}:${u.codigoUnidade}`, {
        orgaoCnpj: o.cnpj,
        codigoUnidade: u.codigoUnidade,
        nomeUnidade: u.nomeUnidade ?? u.codigoUnidade,
        codigoIbge: u.codigoIbge,
        ufSigla: u.ufSigla,
        municipioNome: u.municipioNome,
      });
    }
    if (u?.codigoIbge && u.municipioNome && u.ufSigla) {
      municipios.set(u.codigoIbge, { codigoIbge: u.codigoIbge, nome: u.municipioNome, uf: u.ufSigla });
    }
    descoberto("modalidade", r.modalidadeId, r.modalidadeNome);
    descoberto("modo_disputa", r.modoDisputaId, r.modoDisputaNome);
    descoberto("instrumento_convocatorio", r.tipoInstrumentoConvocatorioCodigo, r.tipoInstrumentoConvocatorioNome);
    descoberto("situacao_contratacao", r.situacaoCompraId, r.situacaoCompraNome);
    descoberto("amparo_legal", r.amparoLegal?.codigo, r.amparoLegal?.nome);
    descoberto("esfera", o.esferaId, null);
    descoberto("poder", o.poderId, null);
    for (const f of r.fontesOrcamentarias ?? []) descoberto("fonte_orcamentaria", f.codigo, f.nome);
  }

  if (orgaos.size)
    await db
      .insert(orgao)
      .values([...orgaos.values()])
      .onConflictDoUpdate({
        target: orgao.cnpj,
        set: {
          razaoSocial: sql`excluded.razao_social`,
          esferaId: sql`excluded.esfera_id`,
          poderId: sql`excluded.poder_id`,
          atualizadoEm: sql`excluded.atualizado_em`,
        },
      });
  if (unidades.size)
    await db
      .insert(unidadeOrgao)
      .values([...unidades.values()])
      .onConflictDoUpdate({
        target: [unidadeOrgao.orgaoCnpj, unidadeOrgao.codigoUnidade],
        set: {
          nomeUnidade: sql`excluded.nome_unidade`,
          codigoIbge: sql`excluded.codigo_ibge`,
          ufSigla: sql`excluded.uf_sigla`,
          municipioNome: sql`excluded.municipio_nome`,
        },
      });
  if (municipios.size) await db.insert(municipio).values([...municipios.values()]).onConflictDoNothing();
  // Código já conhecido não muda; código novo entra como "descoberto" para o admin revisar.
  if (dominios.size) await db.insert(dominio).values([...dominios.values()]).onConflictDoNothing();
}

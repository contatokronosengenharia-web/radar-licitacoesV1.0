import { sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db";
import { enfileirar } from "@/fila/fila";
import type { Criterios } from "./criterios";

// Catálogo de filtros: cada critério vira uma condição SQL sobre a tabela contratacao (alias c).
// Todos são aplicados no nosso banco; nenhum filtro de empresa é enviado ao PNCP.

// Plural e singular em português que o stemmer do Postgres não une (material/materiais, pneu/pneus).
export function variantes(palavra: string): string[] {
  const p = palavra.toLowerCase();
  const v = new Set([p]);
  const troca = (de: string, para: string) => p.endsWith(de) && p.length > de.length + 1 && v.add(p.slice(0, -de.length) + para);
  troca("ais", "al");
  troca("al", "ais");
  troca("eis", "el");
  troca("el", "eis");
  troca("oes", "ao");
  troca("ões", "ão");
  troca("ao", "oes");
  troca("ão", "ões");
  troca("ns", "m");
  troca("m", "ns");
  troca("res", "r");
  troca("r", "res");
  return [...v];
}

/** Termo sem aspas: todas as palavras, cada uma em qualquer variante, casando por prefixo. */
export function montarConsultaPalavras(termo: string): string | null {
  const palavras = termo.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (palavras.length === 0) return null;
  return palavras.map((w) => `(${variantes(w).map((x) => `${x}:*`).join(" | ")})`).join(" & ");
}

function termoParaTsquery(termo: string): SQL | null {
  const limpo = termo.trim();
  if (/^".+"$/.test(limpo)) {
    // Expressão entre aspas: as palavras precisam aparecer juntas e nessa ordem.
    return sql`phraseto_tsquery('portuguese', radar_unaccent(${limpo.slice(1, -1)}))`;
  }
  const consulta = montarConsultaPalavras(limpo);
  return consulta ? sql`to_tsquery('portuguese', radar_unaccent(${consulta}))` : null;
}

function algumTermo(termos: string[]): SQL {
  const consultas = termos.map(termoParaTsquery).filter((q): q is SQL => q !== null);
  if (consultas.length === 0) return sql`false`;
  return sql`c.busca @@ (${sql.join(consultas, sql` || `)})`;
}

const intArray = (v: number[]) => sql`${`{${v.join(",")}}`}::int[]`;
// Listas de texto vão como JSON, para não depender de escapar o literal de array do Postgres.
const textArray = (v: string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(v)}::jsonb))`;

export function compilarCondicao(c: Criterios, agora: Date = new Date()): SQL {
  const partes: SQL[] = [];

  const incluir = c.palavras.incluir.filter((t) => t.trim());
  const excluir = c.palavras.excluir.filter((t) => t.trim());
  if (incluir.length) partes.push(algumTermo(incluir));
  if (excluir.length) partes.push(sql`not coalesce(${algumTermo(excluir)}, false)`);

  if (c.status.length) {
    const opcoes: SQL[] = [];
    if (c.status.includes("recebendo_propostas"))
      opcoes.push(sql`(c.situacao_id = 1 and c.data_encerramento_proposta > ${agora})`);
    if (c.status.includes("propostas_encerradas")) opcoes.push(sql`(c.data_encerramento_proposta <= ${agora})`);
    partes.push(sql`(${sql.join(opcoes, sql` or `)})`);
  }

  if (c.situacoes.length) partes.push(sql`c.situacao_id = any(${intArray(c.situacoes)})`);
  if (c.modalidades.length) partes.push(sql`c.modalidade_id = any(${intArray(c.modalidades)})`);
  if (c.modosDisputa.length) partes.push(sql`c.modo_disputa_id = any(${intArray(c.modosDisputa)})`);
  if (c.instrumentos.length) partes.push(sql`c.instrumento_convocatorio_id = any(${intArray(c.instrumentos)})`);
  if (c.amparosLegais.length) partes.push(sql`c.amparo_legal_codigo = any(${intArray(c.amparosLegais)})`);
  if (c.fontesOrcamentarias.length) partes.push(sql`c.fontes_orcamentarias && ${intArray(c.fontesOrcamentarias)}`);
  if (c.orgaos.length) partes.push(sql`c.orgao_cnpj = any(${textArray(c.orgaos)})`);
  if (c.unidades.length)
    partes.push(sql`(c.orgao_cnpj || ':' || c.codigo_unidade) = any(${textArray(c.unidades)})`);
  if (c.ufs.length) partes.push(sql`c.uf_sigla = any(${textArray(c.ufs)})`);
  if (c.municipios.length) partes.push(sql`c.codigo_ibge = any(${textArray(c.municipios)})`);
  if (c.esferas.length) partes.push(sql`c.esfera_id = any(${textArray(c.esferas)})`);
  if (c.poderes.length) partes.push(sql`c.poder_id = any(${textArray(c.poderes)})`);

  const { min, max, incluirSigiloso } = c.valor;
  if (min != null || max != null) {
    const faixa: SQL[] = [];
    if (min != null) faixa.push(sql`c.valor_total_estimado >= ${min}`);
    if (max != null) faixa.push(sql`c.valor_total_estimado <= ${max}`);
    const semValor = sql`(c.valor_total_estimado is null or c.orcamento_sigiloso = 'COMPRA_TOTALMENTE_SIGILOSA')`;
    partes.push(
      incluirSigiloso
        ? sql`((${sql.join(faixa, sql` and `)}) or ${semValor})`
        : sql`(${sql.join(faixa, sql` and `)} and not ${semValor})`,
    );
  }

  if (c.srp != null) partes.push(sql`c.srp = ${c.srp}`);
  if (c.prazoMinimoDias != null && c.prazoMinimoDias > 0) {
    const limite = new Date(agora.getTime() + c.prazoMinimoDias * 86_400_000);
    partes.push(sql`c.data_encerramento_proposta >= ${limite}`);
  }

  return partes.length ? sql.join(partes, sql` and `) : sql`true`;
}

type PerfilAtivo = {
  id: string;
  empresa_id: string;
  versao: number;
  criterios: Criterios;
};

const LOTE = Number(process.env.MOTOR_LOTE ?? 500);

/**
 * Processa um lote de contratações que ainda não passaram pelo motor, contra a versão ATUAL
 * de cada perfil ativo. Tudo numa transação: se falhar, o lote volta a ficar pendente.
 * Devolve quantas contratações foram processadas.
 */
export async function processarLote(db: Db, agora: Date = new Date()) {
  return db.transaction(async (tx) => {
    const lote = await tx.execute<{ id: number }>(sql`
      select id from contratacao where motor_processado_em is null
      order by id limit ${LOTE} for update skip locked`);
    const ids = lote.rows.map((r) => Number(r.id));
    if (ids.length === 0) return { contratacoes: 0, oportunidades: 0 };

    const perfis = await tx.execute<PerfilAtivo>(sql`
      select p.id, p.empresa_id, p.versao, p.criterios
      from perfil_filtro p join empresa e on e.id = p.empresa_id
      where p.ativo and e.ativa`);

    let oportunidades = 0;
    for (const perfil of perfis.rows) {
      const condicao = compilarCondicao(perfil.criterios, agora);
      const casadas = await tx.execute<{ id: number }>(sql`
        select c.id from contratacao c where c.id = any(${intArray(ids)}) and (${condicao})`);
      const casadasIds = casadas.rows.map((r) => Number(r.id));
      if (casadasIds.length === 0) continue;
      // Única por empresa + contratação: se outro perfil já trouxe, nada é duplicado.
      const inseridas = await tx.execute(sql`
        insert into oportunidade (empresa_id, contratacao_id)
        select ${perfil.empresa_id}::uuid, unnest(${intArray(casadasIds)})
        on conflict (empresa_id, contratacao_id) do nothing`);
      oportunidades += inseridas.rowCount ?? 0;
      await tx.execute(sql`
        insert into oportunidade_perfil (oportunidade_id, perfil_id, perfil_versao)
        select o.id, ${perfil.id}::uuid, ${perfil.versao} from oportunidade o
        where o.empresa_id = ${perfil.empresa_id}::uuid and o.contratacao_id = any(${intArray(casadasIds)})
        on conflict do nothing`);
    }

    await tx.execute(sql`update contratacao set motor_processado_em = ${agora} where id = any(${intArray(ids)})`);
    return { contratacoes: ids.length, oportunidades };
  });
}

/** Tarefa da fila: processa lotes; se ainda houver pendentes, agenda a continuação. */
export async function tarefaMotor(db: Db) {
  const inicio = Date.now();
  const orcamentoMs = Number(process.env.MOTOR_ORCAMENTO_MS ?? 60_000);
  let ultimo = { contratacoes: 0, oportunidades: 0 };
  do {
    ultimo = await processarLote(db);
  } while (ultimo.contratacoes > 0 && Date.now() - inicio < orcamentoMs);
  if (ultimo.contratacoes > 0) {
    await enfileirar(db, [{ tipo: "motor_lote", chaveUnica: `motor:continua:${Date.now()}` }]);
  }
}

/** Prévia: o que este perfil teria encontrado entre as contratações dos últimos N dias. */
export async function previaPerfil(db: Db, criterios: Criterios, dias = 7, limite = 50) {
  const desde = new Date(Date.now() - dias * 86_400_000);
  const r = await db.execute<{ id: number; total: number }>(sql`
    select c.id, count(*) over ()::int as total from contratacao c
    where c.data_publicacao_pncp >= ${desde} and (${compilarCondicao(criterios)})
    order by c.data_publicacao_pncp desc limit ${limite}`);
  return { ids: r.rows.map((x) => Number(x.id)), total: r.rows[0]?.total ?? 0 };
}

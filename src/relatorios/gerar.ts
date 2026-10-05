import { sql, type SQL } from "drizzle-orm";
import { proximoRelatorio } from "@/contas/horario";
import type { Db } from "@/db";
import type { ResumoItem } from "@/db/schema";
import type { Criterios } from "@/filtros/criterios";
import { compilarCondicao } from "@/filtros/motor";
import { BASE_LINK_PNCP } from "@/pncp/links";

// Etapa GERAÇÃO DO RELATÓRIO: não consulta o PNCP. Usa só oportunidades já gravadas
// pelo motor de filtros e ainda não enviadas em nenhum relatório da empresa.

type EmpresaDevida = {
  id: string;
  hora_relatorio: string;
  fuso_horario: string;
  proximo_relatorio_em: string;
  criado_em: string;
};

type PerfilAtivo = { id: string; versao: number; criterios: Criterios };

export type ResultadoRelatorio =
  | { gerado: true; relatorioId: number; empresaId: string; total: number; excluidas: number; proximo: Date }
  | { gerado: false; empresaId: string; motivo: "nao_devido" | "ja_gerado"; proximo?: Date };

const intArray = (v: number[]) => sql`${`{${v.join(",")}}`}::int[]`;

/**
 * Gera o relatório de uma empresa se o horário dela já chegou. Tudo numa transação:
 * relatório, itens, marcação das oportunidades, entrega no painel e o próximo horário.
 * A linha da empresa fica travada (SKIP LOCKED), então duas execuções simultâneas do
 * cron nunca geram o mesmo relatório.
 */
export async function gerarRelatorioEmpresa(db: Db, empresaId: string, agora: Date = new Date()): Promise<ResultadoRelatorio> {
  return db.transaction(async (tx) => {
    const r = await tx.execute<EmpresaDevida>(sql`
      select id, hora_relatorio, fuso_horario,
        to_json(proximo_relatorio_em) #>> '{}' as proximo_relatorio_em,
        to_json(criado_em) #>> '{}' as criado_em
      from empresa
      where id = ${empresaId} and ativa and proximo_relatorio_em <= ${agora}
      for update skip locked`);
    const e = r.rows[0];
    if (!e) return { gerado: false, empresaId, motivo: "nao_devido" } as const;

    const agendadoPara = new Date(e.proximo_relatorio_em);
    // Se o sistema ficou parado e perdeu horários, sai um único relatório com tudo
    // e o próximo vai para o próximo horário futuro (não recupera dia a dia).
    const proximo = proximoRelatorio(e.hora_relatorio, e.fuso_horario, agora);
    const avancar = () => tx.execute(sql`update empresa set proximo_relatorio_em = ${proximo} where id = ${e.id}`);

    const anterior = await tx.execute<{ fim: string }>(sql`
      select to_json(max(periodo_fim)) #>> '{}' as fim from relatorio where empresa_id = ${e.id}`);
    const periodoInicio = new Date(anterior.rows[0]?.fim ?? e.criado_em);

    const novo = await tx.execute<{ id: number }>(sql`
      insert into relatorio (empresa_id, agendado_para, fuso_horario, hora_relatorio, periodo_inicio, periodo_fim, gerado_em)
      values (${e.id}, ${agendadoPara}, ${e.fuso_horario}, ${e.hora_relatorio}, ${periodoInicio}, ${agora}, ${agora})
      on conflict (empresa_id, agendado_para) do nothing
      returning id`);
    if (novo.rows.length === 0) {
      await avancar();
      return { gerado: false, empresaId: e.id, motivo: "ja_gerado", proximo } as const;
    }
    const relatorioId = Number(novo.rows[0].id);

    const perfis = (
      await tx.execute<PerfilAtivo>(sql`
        select id, versao, criterios from perfil_filtro where empresa_id = ${e.id} and ativo order by principal desc, criado_em`)
    ).rows;

    // Pendentes: encontradas pelo motor, ainda fora de qualquer relatório e não excluídas.
    const pendentes = (
      await tx.execute<{ id: number }>(sql`
        select o.id from oportunidade o
        where o.empresa_id = ${e.id} and o.relatorio_id is null and o.excluida_relatorio_em is null
          and o.encontrada_em <= ${agora}
        for update`)
    ).rows.map((x) => Number(x.id));

    // Os filtros ATIVOS são reaplicados agora: o que mudou desde que a oportunidade foi
    // encontrada (filtro alterado, prazo encerrado, revogação) deixa de ser relevante.
    const incluidas: { id: number; perfilId: string }[] = [];
    if (pendentes.length && perfis.length) {
      const casos: SQL[] = perfis.map((p) => sql`when ${compilarCondicao(p.criterios, agora)} then ${p.id}::uuid`);
      const r2 = await tx.execute<{ id: number; perfil_id: string | null }>(sql`
        select o.id, case ${sql.join(casos, sql` `)} end as perfil_id
        from oportunidade o join contratacao c on c.id = o.contratacao_id
        where o.id = any(${intArray(pendentes)}) and o.marcacao is distinct from 'descartada'`);
      for (const x of r2.rows) if (x.perfil_id) incluidas.push({ id: Number(x.id), perfilId: x.perfil_id });
    }
    const idsIncluidas = incluidas.map((i) => i.id);
    const excluidas = pendentes.filter((id) => !idsIncluidas.includes(id));

    let total = 0;
    if (incluidas.length) {
      const perfilPorOportunidade = JSON.stringify(Object.fromEntries(incluidas.map((i) => [i.id, i.perfilId])));
      const itens = await tx.execute<{ id: number }>(sql`
        insert into relatorio_item (relatorio_id, oportunidade_id, perfil_id, posicao, resumo)
        select ${relatorioId}, o.id, (${perfilPorOportunidade}::jsonb ->> o.id::text)::uuid,
          row_number() over (order by c.data_encerramento_proposta nulls last, o.id),
          jsonb_build_object(
            'numeroControlePncp', c.numero_controle_pncp,
            'objeto', c.objeto_compra,
            'orgao', c.orgao_razao_social,
            'municipio', c.municipio_nome,
            'uf', c.uf_sigla,
            'modalidade', m.nome,
            'valorEstimado', c.valor_total_estimado,
            'encerramentoPropostas', to_json(c.data_encerramento_proposta) #>> '{}',
            'linkPncp', ${BASE_LINK_PNCP}::text || c.orgao_cnpj || '/' || c.ano_compra || '/' || c.sequencial_compra
          )
        from oportunidade o
        join contratacao c on c.id = o.contratacao_id
        left join dominio m on m.tipo = 'modalidade' and m.codigo = c.modalidade_id::text
        where o.id = any(${intArray(idsIncluidas)})
        -- O índice único por oportunidade é a garantia final de que nada sai duas vezes.
        on conflict (oportunidade_id) do nothing
        returning oportunidade_id as id`);
      const gravadas = itens.rows.map((x) => Number(x.id));
      total = gravadas.length;
      if (total) {
        await tx.execute(sql`update oportunidade set relatorio_id = ${relatorioId}
          where id = any(${intArray(gravadas)}) and relatorio_id is null`);
      }
    }
    if (excluidas.length) {
      await tx.execute(sql`update oportunidade set excluida_relatorio_em = ${agora} where id = any(${intArray(excluidas)})`);
    }

    await tx.execute(sql`update relatorio set total = ${total}, excluidas = ${excluidas.length},
      perfis = ${JSON.stringify(perfis.map((p) => ({ perfilId: p.id, versao: p.versao })))}::jsonb
      where id = ${relatorioId}`);
    // O painel é o canal de hoje. O WhatsApp entrará como outra linha "pendente" aqui.
    await tx.execute(sql`insert into entrega (relatorio_id, canal, situacao, enviado_em)
      values (${relatorioId}, 'painel', 'entregue', ${agora})`);
    await avancar();
    return { gerado: true, relatorioId, empresaId: e.id, total, excluidas: excluidas.length, proximo } as const;
  });
}

/** Chamado pelo cron: gera os relatórios de todas as empresas cujo horário já chegou. */
export async function gerarRelatoriosDevidos(db: Db, agora: Date = new Date(), orcamentoMs = 240_000) {
  const inicio = Date.now();
  const resumo = { gerados: 0, oportunidades: 0, ignorados: 0, falhas: 0 };
  const vistas = new Set<string>();
  while (Date.now() - inicio < orcamentoMs) {
    const devidas = await db.execute<{ id: string }>(sql`
      select id from empresa where ativa and proximo_relatorio_em <= ${agora}
      order by proximo_relatorio_em limit 100`);
    const novas = devidas.rows.filter((d) => !vistas.has(d.id));
    if (novas.length === 0) break;
    for (const d of novas) {
      vistas.add(d.id);
      try {
        const r = await gerarRelatorioEmpresa(db, d.id, agora);
        if (r.gerado) {
          resumo.gerados++;
          resumo.oportunidades += r.total;
        } else resumo.ignorados++;
      } catch (e) {
        // Uma empresa com erro não impede as demais; ela continua devida e entra na próxima rodada.
        resumo.falhas++;
        const erro = e as Error & { cause?: Error };
        console.error(JSON.stringify({ evento: "relatorio_falhou", empresa: d.id, erro: erro.cause?.message ?? erro.message }));
      }
      if (Date.now() - inicio >= orcamentoMs) break;
    }
  }
  return { ...resumo, duracaoMs: Date.now() - inicio };
}

export type { ResumoItem };

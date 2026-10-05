import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { coletaControle, coletaExecucao, type TipoColeta } from "@/db/schema";
import { enfileirar, type TarefaRow } from "@/fila/fila";
import { buscarContratacoes, ErroPncp } from "@/pncp/cliente";
import { diasEntre, diferencaDias, hojeBrasilia, paraParametroPncp, somarDias } from "@/pncp/datas";
import { modalidadesAtivas } from "@/pncp/dominios";
import { gravarContratacoes } from "@/pncp/gravar";

// Primeira coleta: quantos dias antes de hoje começar. Depois disso vale a marca de sucesso.
const DIAS_INICIAIS = Number(process.env.COLETA_DIAS_INICIAIS ?? 1);
// Limite de dias por execução, para recuperar atrasos longos em etapas.
const MAX_DIAS_POR_EXECUCAO = Number(process.env.COLETA_MAX_DIAS ?? 7);
// Execução "em andamento" há mais que isso é considerada abandonada.
const EXECUCAO_EXPIRA_HORAS = Number(process.env.COLETA_EXPIRA_HORAS ?? 3);

export interface ParametrosPagina {
  execucaoId: number;
  endpoint: TipoColeta;
  dia: string; // AAAA-MM-DD
  modalidade: number;
  pagina: number;
}

export const TAREFA_COLETAR_PAGINA = "coletar_pagina";
export const TAREFA_MOTOR = "motor_lote";

/**
 * Janela da próxima coleta: do dia da última coleta concluída com sucesso até hoje.
 * O dia da marca é relido porque a API filtra por data, não por hora; o que já existe
 * no banco conta como duplicado. Se a última coleta falhou, a marca não andou, então
 * esta janela cobre de novo o período perdido.
 */
export function calcularJanela(ultimaSucessoJanelaFim: string | null, hoje: string) {
  let inicio = ultimaSucessoJanelaFim ?? somarDias(hoje, -DIAS_INICIAIS);
  if (inicio > hoje) inicio = hoje;
  const fimMaximo = somarDias(inicio, MAX_DIAS_POR_EXECUCAO - 1);
  const fim = diferencaDias(inicio, hoje) >= MAX_DIAS_POR_EXECUCAO ? fimMaximo : hoje;
  return { inicio, fim };
}

export type ResultadoInicio =
  | { iniciada: true; execucaoId: number; janela: { inicio: string; fim: string }; tarefas: number }
  | { iniciada: false; motivo: string; execucaoId?: number };

/** Abre uma execução de coleta centralizada e enfileira uma tarefa por dia × modalidade. */
export async function iniciarColeta(db: Db, tipo: TipoColeta, gatilho = "cron"): Promise<ResultadoInicio> {
  // Uma execução por vez por tipo. Se a anterior travou, ela é encerrada como falha.
  const [aberta] = await db
    .select()
    .from(coletaExecucao)
    .where(and(eq(coletaExecucao.tipo, tipo), eq(coletaExecucao.situacao, "em_andamento")))
    .limit(1);
  if (aberta) {
    const horas = (Date.now() - aberta.iniciadaEm.getTime()) / 3_600_000;
    if (horas < EXECUCAO_EXPIRA_HORAS) {
      return { iniciada: false, motivo: "Já existe uma coleta em andamento", execucaoId: aberta.id };
    }
    await encerrarExecucao(db, aberta.id, "falha", "Execução abandonada (tempo esgotado)");
  }

  const modalidades = await modalidadesAtivas(db);
  if (modalidades.length === 0) {
    return { iniciada: false, motivo: "Nenhuma modalidade no banco. Rode a sincronização de domínios." };
  }

  const [controle] = await db.select().from(coletaControle).where(eq(coletaControle.tipo, tipo));
  const janela = calcularJanela(controle?.ultimaSucessoJanelaFim ?? null, hojeBrasilia());

  const [execucao] = await db
    .insert(coletaExecucao)
    .values({ tipo, gatilho, janelaInicio: janela.inicio, janelaFim: janela.fim })
    .returning({ id: coletaExecucao.id, iniciadaEm: coletaExecucao.iniciadaEm });

  await db
    .insert(coletaControle)
    .values({ tipo, ultimaIniciadaEm: execucao.iniciadaEm, ultimaIniciadaExecucaoId: execucao.id })
    .onConflictDoUpdate({
      target: coletaControle.tipo,
      set: { ultimaIniciadaEm: execucao.iniciadaEm, ultimaIniciadaExecucaoId: execucao.id },
    });

  const tarefas = diasEntre(janela.inicio, janela.fim).flatMap((dia) =>
    modalidades.map((modalidade) => ({
      tipo: TAREFA_COLETAR_PAGINA,
      execucaoId: execucao.id,
      chaveUnica: `coleta:${execucao.id}:${dia}:${modalidade}:1`,
      parametros: { execucaoId: execucao.id, endpoint: tipo, dia, modalidade, pagina: 1 } satisfies ParametrosPagina,
    })),
  );
  await enfileirar(db, tarefas);
  return { iniciada: true, execucaoId: execucao.id, janela, tarefas: tarefas.length };
}

/** Tarefa: busca uma página no PNCP, grava com deduplicação e agenda a página seguinte. */
export async function tarefaColetarPagina(db: Db, t: TarefaRow) {
  const p = t.parametros as ParametrosPagina;
  let pagina;
  try {
    pagina = await buscarContratacoes({
      endpoint: p.endpoint,
      dataInicial: paraParametroPncp(p.dia),
      dataFinal: paraParametroPncp(p.dia),
      codigoModalidadeContratacao: p.modalidade,
      pagina: p.pagina,
    });
  } catch (e) {
    if (e instanceof ErroPncp) throw Object.assign(e, { repetivel: e.repetivel });
    throw e;
  }

  const contagem = await gravarContratacoes(db, pagina.data);
  await db.execute(sql`update coleta_execucao set
      paginas = paginas + 1,
      registros_recebidos = registros_recebidos + ${contagem.recebidos},
      registros_novos = registros_novos + ${contagem.novos},
      registros_atualizados = registros_atualizados + ${contagem.atualizados},
      registros_duplicados = registros_duplicados + ${contagem.duplicados}
    where id = ${p.execucaoId}`);

  // A próxima página entra na fila antes desta ser concluída, para a execução não fechar cedo.
  if (pagina.paginasRestantes > 0) {
    const proxima: ParametrosPagina = { ...p, pagina: p.pagina + 1 };
    await enfileirar(db, [
      {
        tipo: TAREFA_COLETAR_PAGINA,
        execucaoId: p.execucaoId,
        chaveUnica: `coleta:${p.execucaoId}:${p.dia}:${p.modalidade}:${proxima.pagina}`,
        parametros: { ...proxima },
      },
    ]);
  }
}

/** Chamado quando uma tarefa de coleta falha de vez: registra o erro na execução. */
export async function registrarErroColeta(db: Db, t: TarefaRow, erro: string) {
  if (t.tipo !== TAREFA_COLETAR_PAGINA || !t.execucaoId) return;
  const p = t.parametros as ParametrosPagina;
  const detalhe = JSON.stringify([
    { quando: new Date().toISOString(), tarefa: `${p.dia} modalidade ${p.modalidade} página ${p.pagina}`, erro },
  ]);
  await db.execute(sql`update coleta_execucao set erros = erros + 1,
      erro_detalhe = erro_detalhe || ${detalhe}::jsonb where id = ${t.execucaoId}`);
}

/**
 * Fecha a execução quando não restam tarefas pendentes. Só uma chamada consegue fechar
 * (condição situacao = 'em_andamento'). Em sucesso, a marca de controle avança.
 * Em qualquer caso, o motor de filtros é acionado para o que foi gravado.
 */
export async function verificarConclusao(db: Db, execucaoId: number) {
  const r = await db.execute<{ abertas: number; falhas: number }>(sql`
    select count(*) filter (where situacao in ('pendente', 'executando'))::int as abertas,
           count(*) filter (where situacao = 'falha')::int as falhas
    from tarefa where execucao_id = ${execucaoId}`);
  const { abertas, falhas } = r.rows[0];
  if (abertas > 0) return;
  await encerrarExecucao(db, execucaoId, falhas > 0 ? "falha" : "sucesso");
}

async function encerrarExecucao(db: Db, execucaoId: number, situacao: "sucesso" | "falha", motivo?: string) {
  const detalhe = motivo ? JSON.stringify([{ quando: new Date().toISOString(), tarefa: "execução", erro: motivo }]) : "[]";
  const r = await db.execute<{ tipo: TipoColeta; janela_fim: string; concluida_em: Date }>(sql`
    update coleta_execucao set situacao = ${situacao}, concluida_em = now(),
      duracao_ms = (extract(epoch from (now() - iniciada_em)) * 1000)::int,
      erro_detalhe = erro_detalhe || ${detalhe}::jsonb
    where id = ${execucaoId} and situacao = 'em_andamento'
    returning tipo, janela_fim::text as janela_fim, concluida_em`);
  const fechada = r.rows[0];
  if (!fechada) return;

  if (situacao === "falha") {
    await db.execute(sql`update tarefa set situacao = 'falha', ultimo_erro = coalesce(ultimo_erro, 'execução encerrada')
      where execucao_id = ${execucaoId} and situacao in ('pendente', 'executando')`);
  } else {
    // A marca nunca anda para trás.
    await db.execute(sql`update coleta_controle set
        ultima_sucesso_em = ${fechada.concluida_em},
        ultima_sucesso_execucao_id = ${execucaoId},
        ultima_sucesso_janela_fim = greatest(coalesce(ultima_sucesso_janela_fim, ${fechada.janela_fim}::date), ${fechada.janela_fim}::date)
      where tipo = ${fechada.tipo}`);
  }
  await enfileirar(db, [{ tipo: TAREFA_MOTOR, chaveUnica: `motor:execucao:${execucaoId}` }]);
}

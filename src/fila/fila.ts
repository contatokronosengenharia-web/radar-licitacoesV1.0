import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { tarefa } from "@/db/schema";

export interface NovaTarefa {
  tipo: string;
  parametros?: Record<string, unknown>;
  chaveUnica?: string;
  execucaoId?: number;
  maxTentativas?: number;
  executarApos?: Date;
}

export type TarefaRow = typeof tarefa.$inferSelect;
export type ManipuladorTarefa = (db: Db, t: TarefaRow) => Promise<void>;

/** Enfileira; a chave única impede duplicar a mesma tarefa. */
export async function enfileirar(db: Db, tarefas: NovaTarefa[]) {
  if (tarefas.length === 0) return;
  await db
    .insert(tarefa)
    .values(
      tarefas.map((t) => ({
        tipo: t.tipo,
        parametros: t.parametros ?? {},
        chaveUnica: t.chaveUnica ?? null,
        execucaoId: t.execucaoId ?? null,
        maxTentativas: t.maxTentativas ?? 5,
        executarApos: t.executarApos ?? new Date(),
      })),
    )
    .onConflictDoNothing();
}

const TRAVA_MINUTOS = 10;

/** Pega a próxima tarefa disponível. SKIP LOCKED permite várias execuções em paralelo. */
export async function reservarProxima(db: Db): Promise<TarefaRow | null> {
  const r = await db.execute<Record<string, unknown>>(sql`
    update tarefa set situacao = 'executando', tentativas = tentativas + 1,
      travada_ate = now() + make_interval(mins => ${TRAVA_MINUTOS})
    where id = (
      select id from tarefa
      where (situacao = 'pendente' and executar_apos <= now())
         or (situacao = 'executando' and travada_ate < now())
      order by executar_apos, id
      for update skip locked
      limit 1
    )
    returning id`);
  const id = r.rows[0]?.id;
  if (id == null) return null;
  const [linha] = await db.select().from(tarefa).where(sql`${tarefa.id} = ${Number(id)}`);
  return linha ?? null;
}

export async function concluir(db: Db, id: number) {
  await db.execute(sql`update tarefa set situacao = 'concluida', concluida_em = now(), travada_ate = null,
    ultimo_erro = null where id = ${id}`);
}

/** Registra a falha. Devolve true se a tarefa esgotou as tentativas (falha definitiva). */
export async function registrarFalha(db: Db, t: TarefaRow, erro: string, repetivel = true): Promise<boolean> {
  const definitiva = !repetivel || t.tentativas >= t.maxTentativas;
  // Espera crescente: 30 s, 60 s, 120 s, 240 s...
  const esperaSeg = 30 * 2 ** Math.max(0, t.tentativas - 1);
  await db.execute(sql`update tarefa set
      situacao = ${definitiva ? "falha" : "pendente"},
      executar_apos = now() + make_interval(secs => ${esperaSeg}),
      travada_ate = null,
      ultimo_erro = ${erro.slice(0, 2000)}
    where id = ${t.id}`);
  return definitiva;
}

/**
 * Executa tarefas até acabar o orçamento de tempo. Cada chamada do cron trabalha um pouco;
 * o que sobrar fica para a próxima, sem estourar o limite de duração da função.
 */
export async function processarFila(
  db: Db,
  manipuladores: Record<string, ManipuladorTarefa>,
  orcamentoMs: number,
  ganchos: {
    aoFalharDefinitivamente?: (db: Db, t: TarefaRow, erro: string) => Promise<void>;
    // Roda depois que a tarefa termina (concluída ou falha definitiva).
    aposTerminar?: (db: Db, t: TarefaRow) => Promise<void>;
  } = {},
) {
  const inicio = Date.now();
  const resumo = { executadas: 0, falhas: 0, tipos: {} as Record<string, number> };
  while (Date.now() - inicio < orcamentoMs) {
    const t = await reservarProxima(db);
    if (!t) break;
    const fn = manipuladores[t.tipo];
    try {
      if (!fn) throw Object.assign(new Error(`Tipo de tarefa desconhecido: ${t.tipo}`), { repetivel: false });
      await fn(db, t);
      await concluir(db, t.id);
      resumo.executadas++;
      resumo.tipos[t.tipo] = (resumo.tipos[t.tipo] ?? 0) + 1;
      await ganchos.aposTerminar?.(db, t);
    } catch (e) {
      const erro = e as Error & { repetivel?: boolean; cause?: Error };
      // Erros do banco chegam embrulhados; a causa traz a mensagem útil.
      if (erro.cause?.message) erro.message = `${erro.message.split("\n")[0]} | ${erro.cause.message}`;
      resumo.falhas++;
      console.error(JSON.stringify({ evento: "tarefa_falhou", tarefa: t.id, tipo: t.tipo, erro: erro.message }));
      const definitiva = await registrarFalha(db, t, erro.message, erro.repetivel ?? true);
      if (definitiva) {
        await ganchos.aoFalharDefinitivamente?.(db, t, erro.message);
        await ganchos.aposTerminar?.(db, t);
      }
    }
  }
  return { ...resumo, duracaoMs: Date.now() - inicio };
}

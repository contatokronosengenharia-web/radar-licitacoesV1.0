import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { coletaControle, coletaExecucao } from "@/db/schema";
import { exigirAdmin } from "@/lib/contexto";
import { acaoGerarRelatorios, acaoIniciarColeta, acaoProcessarFila, acaoSincronizarDominios } from "./acoes";
import { BotaoAdmin } from "./BotaoAdmin";

const fmt = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(d)) : "–";
const duracao = (ms: number | null) => (ms == null ? "–" : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 60_000).toFixed(1)} min`);

export default async function Admin() {
  await exigirAdmin();
  const [controles, execucoes, fila, falhas, descobertos, totais] = await Promise.all([
    db.select().from(coletaControle),
    db.select().from(coletaExecucao).orderBy(desc(coletaExecucao.id)).limit(20),
    db.execute<{ tipo: string; situacao: string; n: number }>(sql`
      select tipo, situacao, count(*)::int as n from tarefa
      where situacao in ('pendente', 'executando') or criado_em > now() - interval '1 day'
      group by tipo, situacao order by tipo, situacao`),
    db.execute<{ id: number; tipo: string; tentativas: number; ultimo_erro: string | null; criado_em: string }>(sql`
      select id, tipo, tentativas, ultimo_erro, to_json(criado_em) #>> '{}' as criado_em from tarefa where situacao = 'falha'
      order by id desc limit 10`),
    db.execute<{ tipo: string; codigo: string; nome: string; sincronizado_em: string }>(sql`
      select tipo, codigo, nome, to_json(sincronizado_em) #>> '{}' as sincronizado_em from dominio where origem = 'descoberto' order by tipo, codigo`),
    db.execute<{ empresas: number; contratacoes: number; pendentes_motor: number; oportunidades: number; relatorios: number; dominios: number }>(sql`
      select (select count(*) from empresa)::int as empresas,
             (select count(*) from contratacao)::int as contratacoes,
             (select count(*) from contratacao where motor_processado_em is null)::int as pendentes_motor,
             (select count(*) from oportunidade)::int as oportunidades,
             (select count(*) from relatorio)::int as relatorios,
             (select count(*) from dominio)::int as dominios`),
  ]);
  const t = totais.rows[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administração</h1>
        <Link href="/painel" className="text-sm text-blue-700 underline">Voltar ao painel</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          ["Empresas", t.empresas],
          ["Contratações", t.contratacoes],
          ["Aguardando motor", t.pendentes_motor],
          ["Oportunidades", t.oportunidades],
          ["Relatórios", t.relatorios],
          ["Códigos de domínio", t.dominios],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="cartao">
            <p className="text-xs uppercase text-slate-500">{rotulo}</p>
            <p className="text-2xl font-semibold">{valor}</p>
          </div>
        ))}
      </section>

      <section className="cartao flex flex-wrap items-start gap-4">
        <BotaoAdmin acao={acaoSincronizarDominios} rotulo="Sincronizar domínios do PNCP" />
        <BotaoAdmin acao={acaoIniciarColeta} rotulo="Iniciar coleta de publicações" campos={{ tipo: "publicacao" }} />
        <BotaoAdmin acao={acaoIniciarColeta} rotulo="Iniciar coleta de atualizações" campos={{ tipo: "atualizacao" }} />
        <BotaoAdmin acao={acaoProcessarFila} rotulo="Processar fila agora" />
        <BotaoAdmin acao={acaoGerarRelatorios} rotulo="Gerar relatórios devidos agora" />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Controle da coleta</h2>
        <Tabela
          cabecalho={["Tipo", "Última iniciada", "Último sucesso", "Período coletado até"]}
          linhas={controles.map((c) => [c.tipo, fmt(c.ultimaIniciadaEm), fmt(c.ultimaSucessoEm), c.ultimaSucessoJanelaFim ?? "–"])}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Execuções de coleta</h2>
        <Tabela
          cabecalho={["#", "Tipo", "Situação", "Gatilho", "Período", "Início", "Duração", "Páginas", "Recebidos", "Novos", "Atualizados", "Duplicados", "Erros"]}
          linhas={execucoes.map((e) => [
            e.id,
            e.tipo,
            e.situacao,
            e.gatilho,
            `${e.janelaInicio} a ${e.janelaFim}`,
            fmt(e.iniciadaEm),
            duracao(e.duracaoMs),
            e.paginas,
            e.registrosRecebidos,
            e.registrosNovos,
            e.registrosAtualizados,
            e.registrosDuplicados,
            e.erros,
          ])}
        />
        {execucoes.some((e) => e.erros > 0 || e.situacao === "falha") && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer">Detalhes dos erros</summary>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(
                execucoes.filter((e) => e.erros > 0 || e.situacao === "falha").map((e) => ({ execucao: e.id, erros: e.erroDetalhe })),
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Fila (abertas e últimas 24 h)</h2>
          <Tabela cabecalho={["Tipo", "Situação", "Quantidade"]} linhas={fila.rows.map((f) => [f.tipo, f.situacao, f.n])} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Últimas tarefas com falha</h2>
          <Tabela
            cabecalho={["#", "Tipo", "Tentativas", "Erro"]}
            linhas={falhas.rows.map((f) => [f.id, f.tipo, f.tentativas, f.ultimo_erro ?? "–"])}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Códigos descobertos nos dados (fora das tabelas oficiais)</h2>
        <Tabela
          cabecalho={["Domínio", "Código", "Nome", "Visto em"]}
          linhas={descobertos.rows.map((d) => [d.tipo, d.codigo, d.nome, fmt(d.sincronizado_em)])}
        />
      </section>
    </div>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: (string | number)[][] }) {
  if (linhas.length === 0) return <p className="text-sm text-slate-500">Nada registrado ainda.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{cabecalho.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-slate-100">
              {l.map((v, j) => <td key={j} className="px-3 py-2 align-top">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

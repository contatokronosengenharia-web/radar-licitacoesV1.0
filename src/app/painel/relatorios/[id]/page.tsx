import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { relatorio, relatorioItem } from "@/db/schema";
import { exigirEmpresa } from "@/lib/contexto";
import { montarTextoRelatorio } from "@/relatorios/mensagem";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function DetalheRelatorio(props: PageProps<"/painel/relatorios/[id]">) {
  const { empresa } = await exigirEmpresa();
  const { id } = await props.params;
  const numero = Number(id);
  if (!Number.isSafeInteger(numero)) notFound();
  // Filtrar pela empresa impede abrir o relatório de outra empresa pelo endereço.
  const [rel] = await db
    .select()
    .from(relatorio)
    .where(and(eq(relatorio.id, numero), eq(relatorio.empresaId, empresa.id)));
  if (!rel) notFound();
  const itens = await db
    .select({ resumo: relatorioItem.resumo })
    .from(relatorioItem)
    .where(eq(relatorioItem.relatorioId, rel.id))
    .orderBy(asc(relatorioItem.posicao));
  const resumos = itens.map((i) => i.resumo);
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: rel.fusoHorario });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/painel/relatorios" className="text-sm text-blue-700 underline">← Relatórios</Link>
        <h1 className="mt-2 text-2xl font-bold">Relatório de {fmt.format(rel.geradoEm)}</h1>
        <p className="text-sm text-slate-600">
          Oportunidades encontradas entre {fmt.format(rel.periodoInicio)} e {fmt.format(rel.periodoFim)}: {rel.total}.
          {rel.excluidas > 0 &&
            ` ${rel.excluidas} encontradas antes deixaram de atender aos filtros (prazo encerrado, filtro alterado ou descartadas) e não entraram.`}
        </p>
      </div>

      {resumos.length === 0 ? (
        <div className="cartao text-sm text-slate-600">Nenhuma oportunidade nova neste período.</div>
      ) : (
        <ol className="flex flex-col gap-3">
          {resumos.map((i) => (
            <li key={i.numeroControlePncp} className="cartao flex flex-col gap-1">
              <p className="font-medium">{i.objeto ?? "(sem descrição do objeto)"}</p>
              <p className="text-sm text-slate-700">
                {i.orgao} · {[i.municipio, i.uf].filter(Boolean).join(" / ")}
              </p>
              <p className="text-sm text-slate-600">
                {i.modalidade ?? "–"} · {i.valorEstimado != null ? moeda.format(i.valorEstimado) : "Valor sigiloso / não informado"}
                {i.encerramentoPropostas && ` · propostas até ${fmt.format(new Date(i.encerramentoPropostas))}`}
              </p>
              <a href={i.linkPncp} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
                Ver no PNCP
              </a>
            </li>
          ))}
        </ol>
      )}

      <details className="cartao text-sm">
        <summary className="cursor-pointer font-medium">Texto do relatório (formato da futura mensagem de WhatsApp)</summary>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-slate-700">
          {montarTextoRelatorio({ geradoEm: rel.geradoEm, fusoHorario: rel.fusoHorario, itens: resumos })}
        </pre>
      </details>
    </div>
  );
}

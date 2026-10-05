import type { ResumoItem } from "@/db/schema";

// Texto simples do relatório, montado só a partir do retrato salvo em relatorio_item.
// É o conteúdo que o canal de WhatsApp vai usar quando existir; hoje serve de prévia.

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function montarTextoRelatorio(r: { geradoEm: Date; fusoHorario: string; itens: ResumoItem[] }): string {
  const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: r.fusoHorario });
  const cabecalho = `Radar de Licitações · ${data.format(r.geradoEm)}`;
  if (r.itens.length === 0) return `${cabecalho}\nNenhuma oportunidade nova para os seus filtros desde o último relatório.`;
  const linhas = r.itens.map((i, n) => {
    const local = [i.municipio, i.uf].filter(Boolean).join("/");
    const valor = i.valorEstimado != null ? moeda.format(i.valorEstimado) : "valor não informado";
    const prazo = i.encerramentoPropostas ? ` · propostas até ${data.format(new Date(i.encerramentoPropostas))}` : "";
    return `${n + 1}. ${i.objeto ?? "(sem descrição)"}\n${i.orgao ?? ""} · ${local} · ${valor}${prazo}\n${i.linkPncp}`;
  });
  const titulo = r.itens.length === 1 ? "1 oportunidade nova" : `${r.itens.length} oportunidades novas`;
  return `${cabecalho}\n${titulo}\n\n${linhas.join("\n\n")}`;
}

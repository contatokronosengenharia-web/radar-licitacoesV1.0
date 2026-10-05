import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { exigirEmpresa } from "@/lib/contexto";

const POR_PAGINA = 30;

type Linha = { id: number; gerado_em: string; periodo_inicio: string; total: number; total_geral: number };

export default async function Relatorios(props: PageProps<"/painel/relatorios">) {
  const { empresa } = await exigirEmpresa();
  const sp = await props.searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const r = await db.execute<Linha>(sql`
    select id, to_json(gerado_em) #>> '{}' as gerado_em, to_json(periodo_inicio) #>> '{}' as periodo_inicio,
      total, count(*) over ()::int as total_geral
    from relatorio where empresa_id = ${empresa.id}
    order by gerado_em desc, id desc
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`);
  const linhas = r.rows;
  const paginas = Math.max(1, Math.ceil((linhas[0]?.total_geral ?? 0) / POR_PAGINA));
  const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: empresa.fusoHorario });
  const proximo = empresa.proximoRelatorioEm
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: empresa.fusoHorario }).format(empresa.proximoRelatorioEm)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-slate-600">
          Um relatório por dia, às {empresa.horaRelatorio}, com as oportunidades novas desde o anterior. Cada oportunidade
          aparece em um único relatório. {proximo && <>Próximo: {proximo}. </>}
          <Link href="/painel/configuracoes" className="text-blue-700 underline">Mudar horário</Link>
        </p>
      </div>
      {linhas.length === 0 ? (
        <div className="cartao text-sm text-slate-600">Nenhum relatório gerado ainda.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Gerado em</th>
                <th className="px-3 py-2 font-medium">Período</th>
                <th className="px-3 py-2 font-medium">Oportunidades</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{fmt.format(new Date(l.gerado_em))}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {fmt.format(new Date(l.periodo_inicio))} a {fmt.format(new Date(l.gerado_em))}
                  </td>
                  <td className="px-3 py-2">{l.total}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/painel/relatorios/${l.id}`} className="text-blue-700 underline">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paginas > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pagina > 1 && <Link className="botao-secundario" href={`/painel/relatorios?pagina=${pagina - 1}`}>Anterior</Link>}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link className="botao-secundario" href={`/painel/relatorios?pagina=${pagina + 1}`}>Próxima</Link>}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { marcarOportunidade } from "@/app/painel/acoes";
import { exigirEmpresa } from "@/lib/contexto";

const POR_PAGINA = 25;

const ABAS = {
  novas: { rotulo: "Sem marcação", condicao: sql`o.marcacao is null` },
  interessantes: { rotulo: "Interessantes", condicao: sql`o.marcacao = 'interessante'` },
  descartadas: { rotulo: "Descartadas", condicao: sql`o.marcacao = 'descartada'` },
  todas: { rotulo: "Todas", condicao: sql`true` },
} as const;
type Aba = keyof typeof ABAS;

type Linha = {
  id: number;
  marcacao: string | null;
  objeto_compra: string | null;
  orgao_razao_social: string | null;
  orgao_cnpj: string;
  ano_compra: number;
  sequencial_compra: number;
  municipio_nome: string | null;
  uf_sigla: string | null;
  modalidade: string | null;
  situacao: string | null;
  valor_total_estimado: string | null;
  orcamento_sigiloso: string | null;
  data_encerramento_proposta: string | null;
  link_sistema_origem: string | null;
  total: number;
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function Oportunidades(props: PageProps<"/painel">) {
  const { empresa } = await exigirEmpresa();
  const sp = await props.searchParams;
  const aba: Aba = typeof sp.ver === "string" && sp.ver in ABAS ? (sp.ver as Aba) : "novas";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const r = await db.execute<Linha>(sql`
    select o.id, o.marcacao, c.objeto_compra, c.orgao_razao_social, c.orgao_cnpj,
      c.ano_compra, c.sequencial_compra, c.municipio_nome, c.uf_sigla, c.valor_total_estimado,
      c.orcamento_sigiloso, c.link_sistema_origem,
      -- Consultas diretas devolvem datas como texto do Postgres; ISO é lido sem ambiguidade.
      to_json(c.data_encerramento_proposta) #>> '{}' as data_encerramento_proposta,
      m.nome as modalidade, s.nome as situacao, count(*) over ()::int as total
    from oportunidade o
    join contratacao c on c.id = o.contratacao_id
    left join dominio m on m.tipo = 'modalidade' and m.codigo = c.modalidade_id::text
    left join dominio s on s.tipo = 'situacao_contratacao' and s.codigo = c.situacao_id::text
    where o.empresa_id = ${empresa.id} and ${ABAS[aba].condicao}
    order by o.encontrada_em desc, o.id desc
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`);
  const linhas = r.rows;
  const total = linhas[0]?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Oportunidades</h1>
        <p className="text-sm text-slate-600">
          Contratações publicadas no PNCP que passaram pelos seus filtros. Novas coletas acontecem a cada hora.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(ABAS) as Aba[]).map((a) => (
          <Link
            key={a}
            href={`/painel?ver=${a}`}
            className={a === aba ? "botao" : "botao-secundario"}
          >
            {ABAS[a].rotulo}
          </Link>
        ))}
      </div>

      {linhas.length === 0 ? (
        <div className="cartao text-sm text-slate-600">
          Nenhuma oportunidade aqui ainda. Confira seus <Link href="/painel/filtros" className="text-blue-700 underline">filtros</Link>;
          as oportunidades aparecem conforme novas contratações são coletadas.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {linhas.map((l) => (
            <li key={l.id} className="cartao flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{l.objeto_compra ?? "(sem descrição do objeto)"}</p>
                {l.marcacao && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{l.marcacao}</span>
                )}
              </div>
              <p className="text-sm text-slate-700">
                {l.orgao_razao_social} · {[l.municipio_nome, l.uf_sigla].filter(Boolean).join(" / ")}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
                <div><dt className="text-xs uppercase text-slate-500">Modalidade</dt><dd>{l.modalidade ?? "–"}</dd></div>
                <div><dt className="text-xs uppercase text-slate-500">Situação</dt><dd>{l.situacao ?? "–"}</dd></div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Valor estimado</dt>
                  <dd>{l.valor_total_estimado != null ? moeda.format(Number(l.valor_total_estimado)) : "Sigiloso / não informado"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Propostas até</dt>
                  <dd>{l.data_encerramento_proposta ? dataHora.format(new Date(l.data_encerramento_proposta)) : "–"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  className="text-sm text-blue-700 underline"
                  href={`https://pncp.gov.br/app/editais/${l.orgao_cnpj}/${l.ano_compra}/${l.sequencial_compra}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver no PNCP
                </a>
                {l.link_sistema_origem && (
                  <a className="text-sm text-blue-700 underline" href={l.link_sistema_origem} target="_blank" rel="noreferrer">
                    Sistema de origem
                  </a>
                )}
                <form action={marcarOportunidade} className="ml-auto flex gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  {l.marcacao !== "interessante" && (
                    <button name="marcacao" value="interessante" className="botao-secundario">Interessante</button>
                  )}
                  {l.marcacao !== "descartada" && (
                    <button name="marcacao" value="descartada" className="botao-secundario">Descartar</button>
                  )}
                  {l.marcacao && <button name="marcacao" value="" className="botao-secundario">Desmarcar</button>}
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pagina > 1 && <Link className="botao-secundario" href={`/painel?ver=${aba}&pagina=${pagina - 1}`}>Anterior</Link>}
          <span>Página {pagina} de {paginas} · {total} oportunidades</span>
          {pagina < paginas && <Link className="botao-secundario" href={`/painel?ver=${aba}&pagina=${pagina + 1}`}>Próxima</Link>}
        </div>
      )}
    </div>
  );
}

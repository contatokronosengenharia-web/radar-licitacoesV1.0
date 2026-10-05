"use client";

import { useActionState, useEffect, useState } from "react";
import { previaFiltros, salvarFiltros } from "@/app/painel/acoes";
import type { Criterios, StatusPrazo } from "@/filtros/criterios";
import type { Opcao, TipoBusca, TipoDominioFiltro } from "@/filtros/opcoes";

type Rotulos = { municipios: Opcao[]; orgaos: Opcao[]; unidades: Opcao[] };

const linhas = (texto: string) =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const numero = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", ".")));

export function FormFiltros({
  inicial,
  dominios,
  rotulos,
}: {
  inicial: Criterios;
  dominios: Record<TipoDominioFiltro, Opcao[]>;
  rotulos: Rotulos;
}) {
  const [c, setC] = useState<Criterios>(inicial);
  const [incluir, setIncluir] = useState(inicial.palavras.incluir.join("\n"));
  const [excluir, setExcluir] = useState(inicial.palavras.excluir.join("\n"));
  const [valorMin, setValorMin] = useState(inicial.valor.min?.toString() ?? "");
  const [valorMax, setValorMax] = useState(inicial.valor.max?.toString() ?? "");
  const [municipios, setMunicipios] = useState(rotulos.municipios);
  const [orgaos, setOrgaos] = useState(rotulos.orgaos);
  const [unidades, setUnidades] = useState(rotulos.unidades);

  const [estado, salvar, salvando] = useActionState(salvarFiltros, undefined);
  const [previa, verPrevia, carregandoPrevia] = useActionState(previaFiltros, undefined);

  const criterios: Criterios = {
    ...c,
    palavras: { incluir: linhas(incluir), excluir: linhas(excluir) },
    valor: { ...c.valor, min: numero(valorMin), max: numero(valorMax) },
    municipios: municipios.map((m) => m.valor),
    orgaos: orgaos.map((o) => o.valor),
    unidades: unidades.map((u) => u.valor),
  };

  const alternarStatus = (s: StatusPrazo) =>
    setC((a) => ({ ...a, status: a.status.includes(s) ? a.status.filter((x) => x !== s) : [...a.status, s] }));

  return (
    <form action={salvar} className="flex flex-col gap-6">
      <input type="hidden" name="criterios" value={JSON.stringify(criterios)} />

      <Secao titulo="Palavras-chave" ajuda="Busca no objeto e nas informações complementares. Uma por linha; basta uma delas aparecer. Todas as palavras de uma linha precisam aparecer. Use aspas para expressão exata, por exemplo &quot;material escolar&quot;. Acentos, maiúsculas e plural/singular são ignorados.">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="rotulo">Incluir</span>
            <textarea className="campo h-28" value={incluir} onChange={(e) => setIncluir(e.target.value)} />
          </label>
          <label>
            <span className="rotulo">Excluir (descarta se aparecer)</span>
            <textarea className="campo h-28" value={excluir} onChange={(e) => setExcluir(e.target.value)} />
          </label>
        </div>
      </Secao>

      <Secao titulo="Status" ajuda="Recebendo propostas = situação “Divulgada no PNCP” com prazo de propostas ainda aberto. Encerradas = prazo já passou.">
        <div className="flex flex-wrap gap-4 text-sm">
          <Marcavel rotulo="Recebendo propostas" marcado={c.status.includes("recebendo_propostas")} aoMudar={() => alternarStatus("recebendo_propostas")} />
          <Marcavel rotulo="Propostas encerradas" marcado={c.status.includes("propostas_encerradas")} aoMudar={() => alternarStatus("propostas_encerradas")} />
        </div>
      </Secao>

      <div className="grid gap-6 md:grid-cols-2">
        <ListaDominio titulo="Modalidade da contratação" opcoes={dominios.modalidade} valores={c.modalidades.map(String)} aoMudar={(v) => setC({ ...c, modalidades: v.map(Number) })} />
        <ListaDominio titulo="Situação da contratação" opcoes={dominios.situacao_contratacao} valores={c.situacoes.map(String)} aoMudar={(v) => setC({ ...c, situacoes: v.map(Number) })} />
        <ListaDominio titulo="Modo de disputa" opcoes={dominios.modo_disputa} valores={c.modosDisputa.map(String)} aoMudar={(v) => setC({ ...c, modosDisputa: v.map(Number) })} />
        <ListaDominio titulo="Tipo de instrumento convocatório" opcoes={dominios.instrumento_convocatorio} valores={c.instrumentos.map(String)} aoMudar={(v) => setC({ ...c, instrumentos: v.map(Number) })} />
        <ListaDominio titulo="Esfera" opcoes={dominios.esfera} valores={c.esferas} aoMudar={(v) => setC({ ...c, esferas: v })} />
        <ListaDominio titulo="Poder" opcoes={dominios.poder} valores={c.poderes} aoMudar={(v) => setC({ ...c, poderes: v })} />
        <ListaDominio titulo="UF" opcoes={dominios.uf} valores={c.ufs} aoMudar={(v) => setC({ ...c, ufs: v })} filtravel />
        <ListaDominio titulo="Amparo legal" opcoes={dominios.amparo_legal} valores={c.amparosLegais.map(String)} aoMudar={(v) => setC({ ...c, amparosLegais: v.map(Number) })} filtravel />
        {dominios.fonte_orcamentaria.length > 0 && (
          <ListaDominio titulo="Fonte orçamentária" opcoes={dominios.fonte_orcamentaria} valores={c.fontesOrcamentarias.map(String)} aoMudar={(v) => setC({ ...c, fontesOrcamentarias: v.map(Number) })} filtravel />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <SeletorBusca titulo="Município" tipo="municipio" selecionados={municipios} aoMudar={setMunicipios} />
        <SeletorBusca titulo="Órgão (nome ou CNPJ)" tipo="orgao" selecionados={orgaos} aoMudar={setOrgaos} />
        <SeletorBusca titulo="Unidade do órgão" tipo="unidade" selecionados={unidades} aoMudar={setUnidades} />
      </div>

      <Secao titulo="Valor e outras condições">
        <div className="grid gap-4 md:grid-cols-4">
          <label>
            <span className="rotulo">Valor estimado mínimo (R$)</span>
            <input className="campo" inputMode="decimal" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
          </label>
          <label>
            <span className="rotulo">Valor estimado máximo (R$)</span>
            <input className="campo" inputMode="decimal" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
          </label>
          <label>
            <span className="rotulo">Registro de preços (SRP)</span>
            <select
              className="campo"
              value={c.srp == null ? "" : String(c.srp)}
              onChange={(e) => setC({ ...c, srp: e.target.value === "" ? null : e.target.value === "true" })}
            >
              <option value="">Qualquer</option>
              <option value="true">Somente SRP</option>
              <option value="false">Somente não SRP</option>
            </select>
          </label>
          <label>
            <span className="rotulo">Prazo mínimo para propostas (dias)</span>
            <input
              className="campo"
              type="number"
              min={0}
              max={365}
              value={c.prazoMinimoDias ?? ""}
              onChange={(e) => setC({ ...c, prazoMinimoDias: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="mt-3 text-sm">
          <Marcavel
            rotulo="Na faixa de valor, manter contratações com orçamento sigiloso ou sem valor informado"
            marcado={c.valor.incluirSigiloso}
            aoMudar={() => setC({ ...c, valor: { ...c.valor, incluirSigiloso: !c.valor.incluirSigiloso } })}
          />
        </div>
      </Secao>

      {estado?.erro && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{estado.erro}</p>}
      {estado?.ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{estado.ok}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar filtros"}
        </button>
        <button type="submit" formAction={verPrevia} className="botao-secundario" disabled={carregandoPrevia}>
          {carregandoPrevia ? "Calculando..." : "Prévia: últimos 7 dias"}
        </button>
      </div>

      {previa && (
        <div className="cartao text-sm">
          {"erro" in previa ? (
            <p className="text-red-800">{previa.erro}</p>
          ) : (
            <>
              <p className="mb-2 font-medium">
                {previa.total} contratações dos últimos 7 dias já no banco atendem a estes filtros (nada foi salvo).
              </p>
              <ul className="list-disc pl-5">
                {previa.itens.map((i) => (
                  <li key={i.id}>
                    {i.objeto} <span className="text-slate-500">· {i.orgao} · {i.local}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <fieldset className="cartao">
      <legend className="px-1 font-semibold">{titulo}</legend>
      {ajuda && <p className="mb-3 text-xs text-slate-500">{ajuda}</p>}
      {children}
    </fieldset>
  );
}

function Marcavel({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: () => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={marcado} onChange={aoMudar} />
      {rotulo}
    </label>
  );
}

function ListaDominio({
  titulo,
  opcoes,
  valores,
  aoMudar,
  filtravel,
}: {
  titulo: string;
  opcoes: Opcao[];
  valores: string[];
  aoMudar: (v: string[]) => void;
  filtravel?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const visiveis = busca ? opcoes.filter((o) => normalizar(o.rotulo).includes(normalizar(busca))) : opcoes;
  const alternar = (v: string) => aoMudar(valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v]);
  return (
    <fieldset className="cartao">
      <legend className="px-1 font-semibold">
        {titulo} {valores.length > 0 && <span className="text-xs font-normal text-slate-500">({valores.length})</span>}
      </legend>
      {opcoes.length === 0 ? (
        <p className="text-xs text-slate-500">Tabela ainda não sincronizada com o PNCP.</p>
      ) : (
        <>
          {filtravel && (
            <input className="campo mb-2" placeholder="Filtrar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          )}
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto text-sm">
            {visiveis.map((o) => (
              <label key={o.valor} className={`flex items-start gap-2 ${o.inativo ? "text-slate-400" : ""}`}>
                <input type="checkbox" className="mt-1" checked={valores.includes(o.valor)} onChange={() => alternar(o.valor)} />
                <span>
                  {o.rotulo}
                  {o.inativo && " (inativo no PNCP)"}
                </span>
              </label>
            ))}
          </div>
          {valores.length > 0 && (
            <button type="button" className="mt-2 text-xs text-blue-700 underline" onClick={() => aoMudar([])}>
              Limpar
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}

function SeletorBusca({
  titulo,
  tipo,
  selecionados,
  aoMudar,
}: {
  titulo: string;
  tipo: TipoBusca;
  selecionados: Opcao[];
  aoMudar: (v: Opcao[]) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Opcao[]>([]);

  useEffect(() => {
    if (termo.trim().length < 2) return;
    const controle = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?tipo=${tipo}&q=${encodeURIComponent(termo)}`, { signal: controle.signal });
        if (r.ok) setResultados(await r.json());
      } catch {
        // busca cancelada ao digitar de novo
      }
    }, 250);
    return () => {
      clearTimeout(espera);
      controle.abort();
    };
  }, [termo, tipo]);

  const visiveis = termo.trim().length < 2 ? [] : resultados.filter((r) => !selecionados.some((s) => s.valor === r.valor));

  return (
    <fieldset className="cartao">
      <legend className="px-1 font-semibold">{titulo}</legend>
      <input className="campo" placeholder="Digite para buscar..." value={termo} onChange={(e) => setTermo(e.target.value)} />
      {visiveis.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 text-sm">
          {visiveis.map((r) => (
            <li key={r.valor}>
              <button
                type="button"
                className="w-full px-2 py-1 text-left hover:bg-slate-100"
                onClick={() => {
                  aoMudar([...selecionados, r]);
                  setTermo("");
                }}
              >
                {r.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">Lista formada pelas contratações já coletadas do PNCP.</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {selecionados.map((s) => (
          <span key={s.valor} className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-900">
            {s.rotulo}
            <button type="button" aria-label="Remover" onClick={() => aoMudar(selecionados.filter((x) => x.valor !== s.valor))}>
              ×
            </button>
          </span>
        ))}
      </div>
    </fieldset>
  );
}

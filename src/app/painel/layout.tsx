import Link from "next/link";
import { sair } from "@/app/acoes-conta";
import { exigirEmpresa } from "@/lib/contexto";

const DIAS_TESTE = 7;

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario, empresa } = await exigirEmpresa();
  const admin = (usuario as { adminPlataforma?: boolean }).adminPlataforma;
  // Só informativo no MVP: cobrança e bloqueio ainda não existem.
  const diasRestantes = Math.max(0, DIAS_TESTE - Math.floor((Date.now() - empresa.criadoEm.getTime()) / 86_400_000));
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/painel" className="font-bold text-blue-800">Radar de Licitações</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/painel" className="hover:underline">Oportunidades</Link>
            <Link href="/painel/relatorios" className="hover:underline">Relatórios</Link>
            <Link href="/painel/filtros" className="hover:underline">Filtros</Link>
            <Link href="/painel/configuracoes" className="hover:underline">Configurações</Link>
            {admin && <Link href="/admin" className="hover:underline">Administração</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span title={empresa.razaoSocial} className="max-w-48 truncate">{empresa.razaoSocial}</span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              Teste: {diasRestantes} {diasRestantes === 1 ? "dia" : "dias"}
            </span>
            <form action={sair}>
              <button className="botao-secundario">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

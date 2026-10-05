import { db } from "@/db";
import { opcoesDominios, rotulosSelecionados } from "@/filtros/opcoes";
import { perfilPrincipal } from "@/filtros/perfil";
import { exigirEmpresa } from "@/lib/contexto";
import { FormFiltros } from "./FormFiltros";

export default async function Filtros(props: PageProps<"/painel/filtros">) {
  const { empresa } = await exigirEmpresa();
  const { bemvindo } = await props.searchParams;
  const perfil = await perfilPrincipal(db, empresa.id);
  if (!perfil) throw new Error("Perfil principal não encontrado");
  const [dominios, rotulos] = await Promise.all([opcoesDominios(db), rotulosSelecionados(db, perfil.criterios)]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Filtros da empresa</h1>
        <p className="text-sm text-slate-600">
          Configure uma vez. As alterações valem para as próximas contratações coletadas do PNCP. Campos vazios
          significam “qualquer valor”. Versão atual: {perfil.versao}.
        </p>
      </div>
      {bemvindo && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          Conta criada. Seu teste gratuito de 7 dias começou. Defina abaixo o que sua empresa procura.
        </p>
      )}
      <FormFiltros inicial={perfil.criterios} dominios={dominios} rotulos={rotulos} />
    </div>
  );
}

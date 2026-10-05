import { salvarConfiguracoes } from "@/app/painel/acoes";
import { Formulario } from "@/componentes/Formulario";
import { FUSOS_BRASIL } from "@/contas/horario";
import { exigirEmpresa } from "@/lib/contexto";

const HORARIOS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export default async function Configuracoes() {
  const { empresa } = await exigirEmpresa();
  const proximo = empresa.proximoRelatorioEm
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: empresa.fusoHorario }).format(
        empresa.proximoRelatorioEm,
      )
    : null;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-slate-600">
          O relatório reúne as oportunidades encontradas desde o relatório anterior. Ele usa o que já foi coletado e
          filtrado; não faz uma nova consulta ao PNCP.
        </p>
      </div>
      <div className="cartao">
        <Formulario acao={salvarConfiguracoes} rotuloBotao="Salvar horário">
          <label>
            <span className="rotulo">Horário do relatório diário</span>
            <select name="horaRelatorio" defaultValue={empresa.horaRelatorio} className="campo">
              {HORARIOS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="rotulo">Fuso horário</span>
            <select name="fusoHorario" defaultValue={empresa.fusoHorario} className="campo">
              {FUSOS_BRASIL.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </label>
        </Formulario>
        {proximo && <p className="mt-4 text-sm text-slate-600">Próximo relatório: {proximo}.</p>}
      </div>
    </div>
  );
}

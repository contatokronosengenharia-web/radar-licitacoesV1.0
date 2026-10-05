import type { Db } from "@/db";
import {
  registrarErroColeta,
  tarefaColetarPagina,
  TAREFA_COLETAR_PAGINA,
  TAREFA_MOTOR,
  verificarConclusao,
} from "@/coleta/coleta";
import { tarefaMotor } from "@/filtros/motor";
import { processarFila, type ManipuladorTarefa, type TarefaRow } from "./fila";

export const MANIPULADORES: Record<string, ManipuladorTarefa> = {
  [TAREFA_COLETAR_PAGINA]: tarefaColetarPagina,
  [TAREFA_MOTOR]: tarefaMotor,
};

export function executarFila(db: Db, orcamentoMs: number) {
  return processarFila(db, MANIPULADORES, orcamentoMs, {
    aoFalharDefinitivamente: registrarErroColeta,
    aposTerminar: async (db: Db, t: TarefaRow) => {
      if (t.tipo === TAREFA_COLETAR_PAGINA && t.execucaoId) await verificarConclusao(db, t.execucaoId);
    },
  });
}

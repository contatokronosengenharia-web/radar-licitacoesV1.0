import { describe, expect, it } from "vitest";
import { calcularJanela } from "@/coleta/coleta";
import { diasEntre, hojeBrasilia, parseDataPncp, paraParametroPncp } from "@/pncp/datas";

describe("datas do PNCP", () => {
  it("interpreta datas sem fuso como horário de Brasília", () => {
    expect(parseDataPncp("2026-10-05T09:00:00")?.toISOString()).toBe("2026-10-05T12:00:00.000Z");
    expect(parseDataPncp(null)).toBeNull();
  });
  it("usa o calendário de Brasília para 'hoje'", () => {
    // 02:00 UTC do dia 6 ainda é dia 5 em Brasília.
    expect(hojeBrasilia(new Date("2026-10-06T02:00:00Z"))).toBe("2026-10-05");
  });
  it("formata para o parâmetro da API", () => {
    expect(paraParametroPncp("2026-10-05")).toBe("20261005");
    expect(diasEntre("2026-09-30", "2026-10-02")).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("janela de coleta", () => {
  it("primeira coleta começa no dia anterior", () => {
    expect(calcularJanela(null, "2026-10-05")).toEqual({ inicio: "2026-10-04", fim: "2026-10-05" });
  });
  it("parte do dia da última coleta com sucesso e vai até hoje", () => {
    expect(calcularJanela("2026-10-03", "2026-10-05")).toEqual({ inicio: "2026-10-03", fim: "2026-10-05" });
  });
  it("recupera atrasos longos em etapas de no máximo 7 dias", () => {
    expect(calcularJanela("2026-09-01", "2026-10-05")).toEqual({ inicio: "2026-09-01", fim: "2026-09-07" });
  });
});

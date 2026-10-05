import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj } from "@/contas/cnpj";
import { horaValida, proximoRelatorio } from "@/contas/horario";
import { cronAutorizado } from "@/lib/cron";

const req = (auth?: string) => new Request("http://x/api/cron/coletar", { headers: auth ? { authorization: auth } : {} });

describe("proteção das rotas de cron", () => {
  it("aceita só o Bearer com o CRON_SECRET", () => {
    expect(cronAutorizado(req(`Bearer ${process.env.CRON_SECRET}`))).toBe(true);
    expect(cronAutorizado(req("Bearer errado"))).toBe(false);
    expect(cronAutorizado(req(process.env.CRON_SECRET))).toBe(false);
    expect(cronAutorizado(req())).toBe(false);
  });

  it("recusa tudo quando CRON_SECRET não está configurado", () => {
    const antes = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(cronAutorizado(req("Bearer "))).toBe(false);
      expect(cronAutorizado(req("Bearer undefined"))).toBe(false);
    } finally {
      process.env.CRON_SECRET = antes;
    }
  });
});

describe("horário do relatório", () => {
  it("calcula o próximo horário no fuso da empresa", () => {
    const agora = new Date("2026-10-05T12:00:00Z"); // 09:00 em Brasília
    expect(proximoRelatorio("08:30", "America/Sao_Paulo", agora).toISOString()).toBe("2026-10-06T11:30:00.000Z");
    expect(proximoRelatorio("10:00", "America/Sao_Paulo", agora).toISOString()).toBe("2026-10-05T13:00:00.000Z");
    expect(proximoRelatorio("18:00", "America/Manaus", agora).toISOString()).toBe("2026-10-05T22:00:00.000Z");
    expect(proximoRelatorio("09:00", "America/Sao_Paulo", agora).toISOString()).toBe("2026-10-06T12:00:00.000Z");
  });

  it("só aceita horas cheias ou meias", () => {
    expect(horaValida("08:30")).toBe(true);
    expect(horaValida("8:30")).toBe(false);
    expect(horaValida("08:15")).toBe(false);
    expect(horaValida("24:00")).toBe(false);
  });
});

describe("CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(cnpjValido("88124961000159")).toBe(true);
    expect(cnpjValido("88124961000158")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(formatarCnpj("88124961000159")).toBe("88.124.961/0001-59");
  });
});

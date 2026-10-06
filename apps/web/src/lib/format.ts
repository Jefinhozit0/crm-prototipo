// Formatação padronizada pt-BR. Datas sempre no fuso de São Paulo, pra não
// variar entre servidor (UTC) e navegador.
const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const brlPrecise = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const dateLong = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});

const dateShort = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

export const fmt = {
  brl: (v: number) => brl.format(v),
  brlPrecise: (v: number) => brlPrecise.format(v),
  pct: (v: number) => `${dec.format(v)}%`,
  dec: (v: number) => dec.format(v),
  dateLong: (v: string | Date) => dateLong.format(new Date(v)),
  date: (v: string | Date) => dateShort.format(new Date(v)),
  dateTime: (v: string | Date) => dateTime.format(new Date(v)),
};

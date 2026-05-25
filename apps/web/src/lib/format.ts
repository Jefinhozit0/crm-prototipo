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
});

const dateShort = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const fmt = {
  brl: (v: number) => brl.format(v),
  brlPrecise: (v: number) => brlPrecise.format(v),
  pct: (v: number) => `${dec.format(v)}%`,
  dec: (v: number) => dec.format(v),
  dateLong: (v: string | Date) => dateLong.format(new Date(v)),
  date: (v: string | Date) => dateShort.format(new Date(v)),
};

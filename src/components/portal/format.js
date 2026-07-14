export const formatNumber = (value) => Number(value || 0).toLocaleString("pt-BR");

export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
};

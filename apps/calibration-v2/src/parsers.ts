import * as XLSX from "xlsx";
import type { Campaign, Row, SeparatorRow, Condition } from "./types";
import { toNum } from "./engine";

export async function importCampaignTemplate(
  file: File,
  current: Campaign
): Promise<Campaign> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { cellDates: true });
  const v = (s: string, a: string) => wb.Sheets[s]?.[a]?.v;
  const next: Campaign = {
    ...current,
    id: v("01_CAMPANHA", "B5") || current.id,
    revision: v("01_CAMPANHA", "B6") || current.revision,
    asset: v("01_CAMPANHA", "B8") || current.asset,
    well: v("01_CAMPANHA", "B9") || current.well,
    tag: v("01_CAMPANHA", "B10") || current.tag,
    serial: v("01_CAMPANHA", "B11") || current.serial,
    reference: v("01_CAMPANHA", "B13") || current.reference,
    pb: Number(v("01_CAMPANHA", "B20")) || current.pb,
  };
  const ws = wb.Sheets["IN_01_MPFM"];
  if (ws) {
    const a = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true });
    const rows = a
      .slice(5)
      .filter((x) => x[1] && x[2])
      .map<Row>((x) => ({
        condition: (x[1] === "POST_K" ? "POST_K" : "AS_FOUND") as Condition,
        timestamp: x[2] instanceof Date ? x[2].toISOString() : String(x[2]),
        use: x[3] !== "NÃO",
        duration: Number(x[4]) || 0,
        p: Number(x[6]) || 0,
        t: Number(x[7]) || 0,
        dp: Number(x[8]) || 0,
        gvf: Number(x[9]) || 0,
        wlr: Number(x[10]) || 0,
        oil: Number(x[11]) || 0,
        gas: Number(x[12]) || 0,
        water: Number(x[13]) || 0,
        oilCorr: Number(x[14]) || 0,
        gasCorr: Number(x[15]) || 0,
        waterCorr: Number(x[16]) || 0,
      }));
    if (rows.length) next.rows = rows;
  }
  return next;
}

export async function parseMpfmWindow(
  file: File,
  tag: string,
  start: string,
  end: string,
  condition: Condition
): Promise<Row[]> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { cellDates: true });
  const ws = wb.Sheets["BASE_UNICA_MES"];
  if (!ws) return [];
  const startTime = start ? new Date(start).getTime() : -Infinity;
  const endTime = end ? new Date(end).getTime() : Infinity;
  const out: Row[] = [];
  for (const r of XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true })) {
    if (r[2] !== "Hourly" || r[12] !== tag) continue;
    const date = r[0],
      hour = r[1];
    if (!date || !hour) continue;
    const timestamp = `${date}T${hour}:00`;
    const t = new Date(timestamp).getTime();
    if (Number.isNaN(t) || t < startTime || t > endTime) continue;
    out.push({
      condition,
      timestamp,
      use: true,
      duration: 1,
      p: toNum(r[44]) ?? 0,
      t: toNum(r[45]) ?? 0,
      dp: 0,
      gvf: 0,
      wlr: 0,
      oil: toNum(r[15]) ?? 0,
      gas: toNum(r[14]) ?? 0,
      water: toNum(r[17]) ?? 0,
      oilCorr: toNum(r[20]) ?? 0,
      gasCorr: toNum(r[19]) ?? 0,
      waterCorr: toNum(r[22]) ?? 0,
    });
  }
  return out;
}

export async function parseSeparatorWindow(
  file: File,
  start: string,
  end: string,
  condition: Condition
): Promise<SeparatorRow[]> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { cellDates: true });
  const startTime = start ? new Date(start).getTime() : -Infinity;
  const endTime = end ? new Date(end).getTime() : Infinity;
  type Bucket = {
    p: number | null;
    t: number | null;
    oilGv: number | null;
    oilRho: number | null;
    oilMass: number | null;
    gasMass: number | null;
    gasStd: number | null;
    waterMass: number | null;
    waterVol: number | null;
  };
  const readings: Record<string, Bucket> = {};
  const ensure = (ts: string): Bucket =>
    readings[ts] ??
    (readings[ts] = {
      p: null,
      t: null,
      oilGv: null,
      oilRho: null,
      oilMass: null,
      gasMass: null,
      gasStd: null,
      waterMass: null,
      waterVol: null,
    });
  const eachRow = (
    sheetName: string,
    fn: (r: any[], ts: string) => void
  ): void => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    let currentDay = "";
    for (const r of XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true })) {
      const marker = String(r[2] ?? "");
      const dayMatch = /Data:\s*(\d{4}-\d{2}-\d{2})/.exec(marker);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      if (!currentDay || marker === "DAY") continue;
      const hourNum = Number(marker);
      if (!Number.isInteger(hourNum) || hourNum < 1 || hourNum > 24) continue;
      const timestamp = `${currentDay}T${String(hourNum - 1).padStart(2, "0")}:00`;
      const t = new Date(timestamp).getTime();
      if (Number.isNaN(t) || t < startTime || t > endTime) continue;
      fn(r, timestamp);
    }
  };
  eachRow("separador oleo", (r, ts) => {
    const e = ensure(ts);
    e.p = toNum(r[4]);
    e.t = toNum(r[5]);
    e.oilGv = toNum(r[9]);
    e.oilRho = toNum(r[17]);
    e.oilMass = toNum(r[11]);
  });
  eachRow("separador gas", (r, ts) => {
    const e = ensure(ts);
    e.gasMass = toNum(r[9]);
    const std = toNum(r[8]);
    e.gasStd = std != null ? std / 1000 : null;
  });
  eachRow("separador agua", (r, ts) => {
    const e = ensure(ts);
    e.waterMass = toNum(r[10]);
    e.waterVol = toNum(r[8]);
  });
  return Object.entries(readings).map(([timestamp, v]) => ({
    condition,
    timestamp,
    use_flag: 1,
    duration_h: 1,
    quality: "",
    pressure_barg: v.p,
    temperature_c: v.t,
    oil_gv_line_m3: v.oilGv,
    oil_rho_coriolis_kgm3: v.oilRho,
    oil_mass_direct_t: v.oilMass,
    gas_mass_t: v.gasMass,
    water_mass_t: v.waterMass,
    gas_std_ksm3: v.gasStd,
    water_vol_m3: v.waterVol,
    source_ref: file.name,
  }));
}

export function mergeRowsByKey<T extends { condition: string; timestamp: string }>(
  existing: T[],
  incoming: T[],
  replaceCondition: Condition
): T[] {
  const kept = existing.filter((r) => r.condition !== replaceCondition);
  const byKey = new Map<string, T>();
  for (const r of kept) byKey.set(`${r.condition}::${r.timestamp}`, r);
  for (const r of incoming) byKey.set(`${r.condition}::${r.timestamp}`, r);
  return [...byKey.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0
  );
}

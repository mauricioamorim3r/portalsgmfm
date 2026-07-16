import * as XLSX from "xlsx";
import type { Campaign } from "./types";
import { calculate } from "./engine";

export function exportCampaignExcel(c: Campaign): void {
  const r = calculate(c);
  const wb = XLSX.utils.book_new();
  const camp = [
    ["Campo", "Valor", "Unidade"],
    ["Campaign ID", c.id],
    ["Revisão", c.revision],
    ["Natureza", c.nature],
    ["Ativo", c.asset],
    ["Poço/Riser", c.well],
    ["TAG MPFM", c.tag],
    ["Número de série", c.serial],
    ["Referência", c.reference],
    ["Pb", c.pb, "barg"],
    ["Limite HC", c.hcLimit, "%"],
    ["Limite total", c.totalLimit, "%"],
    ["Timezone", c.timezone],
    ["Responsável", c.responsible],
    ["Aprovador", c.approver],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(camp), "01_CAMPANHA");

  const rows = [
    [
      "Campaign ID",
      "Condição",
      "Timestamp",
      "Usar?",
      "Duração (h)",
      "P (barg)",
      "T (°C)",
      "dP (kPa)",
      "GVF (%)",
      "WLR (%)",
      "Óleo uncorr (t)",
      "Gás uncorr (t)",
      "Água uncorr (t)",
      "Óleo corr (t)",
      "Gás corr (t)",
      "Água corr (t)",
    ],
    ...c.rows.map((x) => [
      c.id,
      x.condition,
      x.timestamp,
      x.use ? "SIM" : "NÃO",
      x.duration,
      x.p,
      x.t,
      x.dp,
      x.gvf,
      x.wlr,
      x.oil,
      x.gas,
      x.water,
      x.oilCorr ?? 0,
      x.gasCorr ?? 0,
      x.waterCorr ?? 0,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "IN_01_MPFM");

  const sep = [
    [
      "Campaign ID",
      "Condição",
      "Timestamp",
      "Usar?",
      "Duração (h)",
      "Qualidade",
      "P (barg)",
      "T (°C)",
      "Óleo GV linha (m³)",
      "Óleo ρ Coriolis (kg/m³)",
      "Óleo massa (t)",
      "Gás massa (t)",
      "Água massa (t)",
      "Gás padrão (ksm³)",
      "Água (m³)",
      "Referência",
    ],
    ...c.separatorRows.map((x) => [
      c.id,
      x.condition,
      x.timestamp,
      x.use_flag ? "SIM" : "NÃO",
      x.duration_h ?? "",
      x.quality,
      x.pressure_barg ?? "",
      x.temperature_c ?? "",
      x.oil_gv_line_m3 ?? "",
      x.oil_rho_coriolis_kgm3 ?? "",
      x.oil_mass_direct_t ?? "",
      x.gas_mass_t ?? "",
      x.water_mass_t ?? "",
      x.gas_std_ksm3 ?? "",
      x.water_vol_m3 ?? "",
      x.source_ref,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sep), "IN_02_SEPARADOR");

  const out = [
    ["Bloco", "Indicador", "Valor", "Unidade"],
    ["As-Found", "Massa HC MPFM", r.asHC, "t"],
    ["As-Found", "Massa HC referência", r.refHC, "t"],
    ["As-Found", "Desvio HC", r.devHC, "%"],
    ["K", "K óleo", r.kOil],
    ["K", "K gás", r.kGas],
    ["K", "K água", r.kWater],
    ["Pós-K", "Desvio HC", r.postDevHC, "%"],
    ["Incerteza", "En As-Found", r.enAs],
    ["Incerteza", "En Pós-K", r.enPost],
    [
      "Decisão",
      "Validade técnica",
      r.technical ? "VÁLIDO" : "NÃO VÁLIDO",
    ],
    [
      "Decisão",
      "Prontidão",
      r.issue ? "APTO PARA EMISSÃO" : "NÃO EMITIR — BLOQUEIO",
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(out), "06_EXPORTACAO");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Gate", "Verificação", "Status"],
      ...r.gates.map((g) => [g[0], g[1], g[2] ? "OK" : "PENDENTE"]),
    ]),
    "03_VALIDACAO"
  );
  const safeRev = (c.revision || "").replace(/\s/g, "");
  XLSX.writeFile(wb, `${c.id}_${safeRev}_${c.tag}.xlsx`);
}

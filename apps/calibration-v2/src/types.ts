export type Condition = "AS_FOUND" | "POST_K";

export type Row = {
  condition: Condition;
  timestamp: string;
  use: boolean;
  duration: number;
  p: number;
  t: number;
  dp: number;
  gvf: number;
  wlr: number;
  oil: number;
  gas: number;
  water: number;
  oilCorr?: number;
  gasCorr?: number;
  waterCorr?: number;
};

export type SeparatorRow = {
  condition: Condition | "";
  timestamp: string;
  use_flag: number;
  duration_h: number | null;
  quality: string;
  pressure_barg: number | null;
  temperature_c: number | null;
  oil_gv_line_m3: number | null;
  oil_rho_coriolis_kgm3: number | null;
  oil_mass_direct_t: number | null;
  gas_mass_t: number | null;
  water_mass_t: number | null;
  gas_std_ksm3: number | null;
  water_vol_m3: number | null;
  source_ref: string;
};

export type LabResult = {
  sample_id: string;
  use_flag: number;
  sampled_at: string;
  sample_type: string;
  bsw_pct: number | null;
  rho_oil_std_kgm3: number | null;
  rho_gas_std_kgsm3: number | null;
  rho_water_std_kgm3: number | null;
  fe: number | null;
  rs: number | null;
  method: string;
  report_id: string;
  status: string;
};

export type Campaign = {
  id: string;
  revision: string;
  nature: string;
  asset: string;
  well: string;
  tag: string;
  serial: string;
  type: string;
  reference: string;
  start: string;
  end: string;
  postStart: string;
  postEnd: string;
  pb: number;
  hcLimit: number;
  totalLimit: number;
  pvtLimit: number;
  kMin: number;
  kMax: number;
  minRecords: number;
  pvtMonths: number;
  timezone: string;
  responsible: string;
  approver: string;
  envelope: {
    p: [number | null, number | null];
    t: [number | null, number | null];
    dp: [number | null, number | null];
    gvf: [number | null, number | null];
    wlr: [number | null, number | null];
  };
  pvt: {
    asOil: number;
    asGas: number;
    asWater: number;
    postOil: number;
    postGas: number;
    postWater: number;
    file: string;
    hash: string;
    software: string;
    version: string;
    approver: string;
  };
  uncertainty: { asMpfm: number; asRef: number; postMpfm: number; postRef: number };
  k: {
    oilApproved: number;
    gasApproved: number;
    waterApproved: number;
    oilApplied: number;
    gasApplied: number;
    waterApplied: number;
    date: string;
    responsible: string;
    evidence: string;
  };
  integrity: {
    raw: boolean;
    dp: boolean;
    units: boolean;
    timezone: boolean;
    gaps: boolean;
    exclusions: boolean;
  };
  evidence: boolean;
  approvals: boolean;
  rows: Row[];
  separatorRows: SeparatorRow[];
  labResults: LabResult[];
};

export function blankCampaign(id: string): Campaign {
  return {
    id,
    revision: "",
    nature: "",
    asset: "",
    well: "",
    tag: "",
    serial: "",
    type: "",
    reference: "",
    start: "",
    end: "",
    postStart: "",
    postEnd: "",
    pb: 0,
    hcLimit: 0.1,
    totalLimit: 0.07,
    pvtLimit: 0.01,
    kMin: 0.8,
    kMax: 1.2,
    minRecords: 24,
    pvtMonths: 6,
    timezone: "",
    responsible: "",
    approver: "",
    envelope: {
      p: [null, null],
      t: [null, null],
      dp: [null, null],
      gvf: [null, null],
      wlr: [null, null],
    },
    pvt: {
      asOil: 0,
      asGas: 0,
      asWater: 0,
      postOil: 0,
      postGas: 0,
      postWater: 0,
      file: "",
      hash: "",
      software: "",
      version: "",
      approver: "",
    },
    uncertainty: { asMpfm: 0, asRef: 0, postMpfm: 0, postRef: 0 },
    k: {
      oilApproved: 0,
      gasApproved: 0,
      waterApproved: 0,
      oilApplied: 0,
      gasApplied: 0,
      waterApplied: 0,
      date: "",
      responsible: "",
      evidence: "",
    },
    integrity: {
      raw: false,
      dp: false,
      units: false,
      timezone: false,
      gaps: false,
      exclusions: false,
    },
    evidence: false,
    approvals: false,
    rows: [],
    separatorRows: [],
    labResults: [],
  };
}

export function blankRow(condition: Condition): Row {
  return {
    condition,
    timestamp: new Date().toISOString().slice(0, 16),
    use: true,
    duration: 1,
    p: 0,
    t: 0,
    dp: 0,
    gvf: 0,
    wlr: 0,
    oil: 0,
    gas: 0,
    water: 0,
    oilCorr: 0,
    gasCorr: 0,
    waterCorr: 0,
  };
}

export function blankSeparatorRow(condition: Condition): SeparatorRow {
  return {
    condition,
    timestamp: new Date().toISOString().slice(0, 16),
    use_flag: 1,
    duration_h: 1,
    quality: "",
    pressure_barg: null,
    temperature_c: null,
    oil_gv_line_m3: null,
    oil_rho_coriolis_kgm3: null,
    oil_mass_direct_t: null,
    gas_mass_t: null,
    water_mass_t: null,
    gas_std_ksm3: null,
    water_vol_m3: null,
    source_ref: "",
  };
}

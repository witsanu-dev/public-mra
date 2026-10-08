import { create } from 'zustand';
import { initialIpdAuditTableRows, IpdAuditTableRow, ScoreValue } from '@/lib/mra-ipd-types';

export interface IpdAuditStore {
  // Hospital and admission info
  hcode: string;
  hname: string;
  currentAn: string;
  currentSampleItemId: string | null;
  currentBatchId: string | null;
  isExistingAudit: boolean;
  currentAuditId: string | null;
  patientName: string;
  hn: string;
  pid: string;
  sex: string;
  age: number;
  wardCode: string;
  wardName: string;
  admitDate: string;
  admitTime: string;
  dischargeDate: string;
  dischargeTime: string;
  lengthOfStay: number;
  dischargeStatus: string;
  dischargeType: string;
  diagnosis: string;
  caseType: 'general' | 'psychiatric';

  // Evaluation outcome (5 ตัวเลือกตามคู่มือ สปสช. หน้า 55, 68, 127)
  overallFinding: 'inadequate' | 'no_issue' | 'certain_issues' | 'order_not_standard' | 'missing_patient_identifiers' | null;
  certainIssueRemarks: string;
  auditorName: string;
  auditDate: string;

  // Data rows
  rows: IpdAuditTableRow[];

  // Criteria search query
  searchQuery: string;

  // Actions
  setField: (field: string, value: any) => void;
  setCriteriaScore: (rowId: string, criteriaIndex: number, score: ScoreValue) => void;
  toggleRowNA: (rowId: string) => void;
  toggleRowMissing: (rowId: string) => void;
  toggleRowNo: (rowId: string) => void;
  setAddScore: (rowId: string, val: number) => void;
  setDeductScore: (rowId: string, val: number) => void;
  setRowRemark: (rowId: string, remarkText: string) => void;
  setSearchQuery: (query: string) => void;
  loadSampledIpdVisit: (visit: {
    an: string;
    hn: string;
    cid?: string;
    patientName?: string;
    sex?: string;
    age?: number;
    wardCode?: string;
    wardName?: string;
    admitDate?: string;
    admitTime?: string;
    dischargeDate?: string;
    dischargeTime?: string;
    lengthOfStay?: number;
    dischargeStatus?: string;
    dischargeType?: string;
    diagnosis?: string;
    diagnosisName?: string;
    itemId?: string;
    batchId?: string;
    hcode?: string;
    hname?: string;
    caseType?: 'general' | 'psychiatric';
  }) => void;
  loadExistingIpdAudit: (an: string) => Promise<boolean>;
  revokeAudit: () => Promise<boolean>;
  initHospitalFromHis: (force?: boolean) => Promise<void>;
  resetAll: () => void;

  // Calculation helpers
  calculateTotals: () => {
    sumScore: number;
    fullScore: number;
    percentage: number;
    minRequiredScore: number;
    isPassedMinScore: boolean;
    isPassed: boolean;
  };
}

export const useIpdAuditStore = create<IpdAuditStore>((set, get) => ({
  hcode: '',
  hname: '',
  currentAn: '',
  currentSampleItemId: null,
  currentBatchId: null,
  isExistingAudit: false,
  currentAuditId: null,
  patientName: '',
  hn: '',
  pid: '',
  sex: '',
  age: 0,
  wardCode: '',
  wardName: '',
  admitDate: '',
  admitTime: '00:00',
  dischargeDate: '',
  dischargeTime: '00:00',
  lengthOfStay: 0,
  dischargeStatus: '',
  dischargeType: '',
  diagnosis: '',
  caseType: 'general',

  overallFinding: 'no_issue',
  certainIssueRemarks: '',
  auditorName: '',
  auditDate: new Date().toISOString().split('T')[0],

  rows: initialIpdAuditTableRows,
  searchQuery: '',

  setField: (field, value) => {
    if (field === 'caseType') {
      const isPsy = value === 'psychiatric';
      set((state) => ({
        caseType: value as 'general' | 'psychiatric',
        rows: state.rows.map((row) => {
          if (row.id === 'ipd_c10') {
            return {
              ...row,
              naSelected: isPsy ? true : row.naSelected,
              missingSelected: isPsy ? false : row.missingSelected,
              noSelected: isPsy ? false : row.noSelected,
              scores: isPsy ? Array(row.maxCriteria).fill(null) : row.scores,
            };
          }
          return row;
        }),
      }));
      return;
    }
    set({ [field]: value });
  },

  setCriteriaScore: (rowId, criteriaIndex, score) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id !== rowId) return row;
        const newScores = [...row.scores];
        newScores[criteriaIndex] = score;
        return {
          ...row,
          scores: newScores,
          naSelected: false,
          missingSelected: false,
          noSelected: false,
        };
      }),
    }));
  },

  toggleRowNA: (rowId) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id !== rowId) return row;
        const nextVal = !row.naSelected;
        return {
          ...row,
          naSelected: nextVal,
          missingSelected: nextVal ? false : row.missingSelected,
          noSelected: nextVal ? false : row.noSelected,
          scores: nextVal ? Array(row.maxCriteria).fill(null) : row.scores,
        };
      }),
    }));
  },

  toggleRowMissing: (rowId) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id !== rowId) return row;
        const nextVal = !row.missingSelected;
        return {
          ...row,
          missingSelected: nextVal,
          naSelected: nextVal ? false : row.naSelected,
          noSelected: nextVal ? false : row.noSelected,
          scores: nextVal ? Array(row.maxCriteria).fill('0') : row.scores,
        };
      }),
    }));
  },

  toggleRowNo: (rowId) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id !== rowId) return row;
        const nextVal = !row.noSelected;
        return {
          ...row,
          noSelected: nextVal,
          naSelected: nextVal ? false : row.naSelected,
          missingSelected: nextVal ? false : row.missingSelected,
          scores: nextVal ? Array(row.maxCriteria).fill('0') : row.scores,
        };
      }),
    }));
  },

  setAddScore: (rowId, val) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id === rowId) {
          const nextAdd = row.addScore === val ? 0 : val;
          let nextRemark = row.remarkText;
          if (nextAdd === 1 && (!row.remarkText || row.remarkText.trim() === '')) {
            nextRemark = '+1 คะแนนพิเศษ';
          } else if (nextAdd === 0 && row.remarkText === '+1 คะแนนพิเศษ') {
            nextRemark = '';
          }
          return { ...row, addScore: nextAdd, remarkText: nextRemark };
        }
        return row;
      }),
    }));
  },

  setDeductScore: (rowId, val) => {
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === rowId ? { ...row, deductScore: row.deductScore === val ? 0 : val } : row
      ),
    }));
  },

  setRowRemark: (rowId, remarkText) => {
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === rowId ? { ...row, remarkText } : row
      ),
    }));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  loadSampledIpdVisit: (visit) => {
    const diag = visit.diagnosis || visit.diagnosisName || '';
    const derivedBatchId = visit.batchId || (visit.itemId ? visit.itemId.replace(/-[0-9]+$/, '') : null) || get().currentBatchId;
    const isPsy = (visit.caseType === 'psychiatric') || (diag.includes('จิตเวช'));
    set({
      currentAn: visit.an,
      currentSampleItemId: visit.itemId || null,
      currentBatchId: derivedBatchId,
      hcode: visit.hcode || get().hcode,
      hname: visit.hname || get().hname,
      hn: visit.hn,
      pid: visit.cid || '',
      patientName: visit.patientName || '',
      sex: visit.sex || '',
      age: visit.age || 0,
      wardCode: visit.wardCode || '',
      wardName: visit.wardName || '',
      admitDate: visit.admitDate || '',
      admitTime: visit.admitTime || '00:00',
      dischargeDate: visit.dischargeDate || '',
      dischargeTime: visit.dischargeTime || '00:00',
      lengthOfStay: visit.lengthOfStay || 0,
      dischargeStatus: visit.dischargeStatus || '',
      dischargeType: visit.dischargeType || '',
      diagnosis: diag,
      caseType: isPsy ? 'psychiatric' : (visit.caseType || 'general'),
      rows: initialIpdAuditTableRows.map((r) => {
        if (r.id === 'ipd_c10' && isPsy) {
          return {
            ...r,
            naSelected: true,
            missingSelected: false,
            noSelected: false,
            scores: Array(r.maxCriteria).fill(null),
          };
        }
        return {
          ...r,
          scores: Array(r.maxCriteria).fill(null),
        };
      }),
    });

    if (visit.an) {
      get().loadExistingIpdAudit(visit.an);
    }
  },

  loadExistingIpdAudit: async (an: string) => {
    if (!an) return false;
    try {
      const res = await fetch(`/api/mra/ipd-audit?an=${encodeURIComponent(an)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const audit = json.data;
        const details = audit.details || [];

        const mappedRows = initialIpdAuditTableRows.map((initialRow) => {
          const match = details.find((d: any) =>
            Number(d.content_no) === Number(initialRow.no)
          );
          if (!match) return initialRow;
          let parsedScores: ScoreValue[] = Array(initialRow.maxCriteria).fill(null);
          try {
            let raw = match.scores_json;
            if (typeof raw === 'string') {
              raw = JSON.parse(raw);
            }
            if (Array.isArray(raw)) {
              parsedScores = [...raw];
            } else if (raw && typeof raw === 'object' && Array.isArray(raw.scores)) {
              parsedScores = [...raw.scores];
            }
            // Ensure array length matches maxCriteria (pads null for any missing elements)
            while (parsedScores.length < initialRow.maxCriteria) {
              parsedScores.push(null);
            }
          } catch {}
          return {
            ...initialRow,
            naSelected: Boolean(match.na_selected),
            missingSelected: Boolean(match.missing_selected),
            noSelected: Boolean(match.no_selected),
            scores: parsedScores,
            addScore: Number(match.add_score) || 0,
            deductScore: Number(match.deduct_score) || 0,
            remarkText: match.remark_text || '',
          };
        });

        const isPsy = Boolean(
          audit.is_psychiatric ||
          audit.isPsychiatric ||
          audit.case_type === 'psychiatric' ||
          audit.caseType === 'psychiatric' ||
          (audit.diagnosis && /จิตเวช|psychiatric|schizo|depress|bipolar/i.test(audit.diagnosis))
        );

        set({
          isExistingAudit: true,
          currentAuditId: audit.audit_id || audit.auditId || null,
          currentAn: audit.an || an || get().currentAn,
          hn: audit.hn || get().hn,
          patientName: audit.patient_name || audit.patientName || get().patientName,
          diagnosis: audit.diagnosis || get().diagnosis,
          wardName: audit.ward_name || audit.wardName || get().wardName,
          admitDate: audit.admit_date ? String(audit.admit_date).split('T')[0] : get().admitDate,
          dischargeDate: audit.discharge_date ? String(audit.discharge_date).split('T')[0] : get().dischargeDate,
          caseType: isPsy ? 'psychiatric' : (audit.case_type || audit.caseType || 'general'),
          overallFinding: audit.overall_finding || audit.overallFinding || 'no_issue',
          certainIssueRemarks: audit.certain_issue_remarks || audit.certainIssueRemarks || '',
          auditorName: audit.auditor_name || audit.auditorName || get().auditorName || '',
          auditDate: audit.audit_date ? String(audit.audit_date).split('T')[0] : new Date().toISOString().split('T')[0],
          rows: mappedRows,
        });
        return true;
      }
      set({ isExistingAudit: false, currentAuditId: null });
      return false;
    } catch (err) {
      console.error('Error loading existing IPD audit:', err);
      set({ isExistingAudit: false, currentAuditId: null });
      return false;
    }
  },

  revokeAudit: async () => {
    const { currentAn, currentSampleItemId, currentAuditId } = get();
    if (!currentAn && !currentSampleItemId && !currentAuditId) return false;

    try {
      const params = new URLSearchParams();
      if (currentAn) params.set('an', currentAn);
      if (currentSampleItemId) params.set('itemId', currentSampleItemId);
      if (currentAuditId) params.set('auditId', currentAuditId);

      const res = await fetch(`/api/mra/ipd-audit?${params.toString()}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        set({
          isExistingAudit: false,
          currentAuditId: null,
          overallFinding: 'no_issue',
          certainIssueRemarks: '',
          rows: initialIpdAuditTableRows,
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error revoking IPD audit:', err);
      return false;
    }
  },

  initHospitalFromHis: async (force = false) => {
    const { hcode, hname } = get();
    if (!force && hcode && hname) return;
    try {
      const res = await fetch('/api/his/meta');
      const json = await res.json();
      if (json.success && json.data) {
        set({
          hcode: json.data.hcode || get().hcode,
          hname: json.data.hname || get().hname,
        });
      }
    } catch {
      // Silent fallback in offline mode
    }
  },

  resetAll: () => {
    set({
      currentAn: '',
      currentSampleItemId: null,
      currentBatchId: null,
      isExistingAudit: false,
      currentAuditId: null,
      patientName: '',
      hn: '',
      pid: '',
      sex: '',
      age: 0,
      wardCode: '',
      wardName: '',
      admitDate: '',
      admitTime: '00:00',
      dischargeDate: '',
      dischargeTime: '00:00',
      lengthOfStay: 0,
      dischargeStatus: '',
      dischargeType: '',
      diagnosis: '',
      overallFinding: 'no_issue',
      certainIssueRemarks: '',
      rows: initialIpdAuditTableRows.map((r) => {
        const isPsy = get().caseType === 'psychiatric';
        if (r.id === 'ipd_c10' && isPsy) {
          return {
            ...r,
            naSelected: true,
            missingSelected: false,
            noSelected: false,
            scores: Array(r.maxCriteria).fill(null),
          };
        }
        return {
          ...r,
          scores: Array(r.maxCriteria).fill(null),
        };
      }),
      searchQuery: '',
    });
  },

  calculateTotals: () => {
    const state = get();
    let sumScore = 0;
    let fullScore = 0;

    state.rows.forEach((row) => {
      // 1. ถ้าเลือก NA ในหมวดนั้น ไม่คิดคะแนนเต็มและคะแนนที่ได้ (ไม่รวม NA ตามคู่มือ สปสช. หน้า 57)
      if (row.naSelected) return;

      // 2. ถ้าเลือก Missing หรือ No:
      // คู่มือ สปสช. หน้า 57 ข้อ 2: "ในกรณีที่ประเมินให้ในช่อง Missing หรือ No จะได้คะแนนเท่ากับ 0 คะแนน"
      // และนับคะแนนเต็มเท่ากับจำนวนเกณฑ์สูงสุดของหมวดนั้น (7 หรือ 9)
      if (row.missingSelected || row.noSelected) {
        fullScore += row.maxCriteria;
        return;
      }

      // 3. คิดคะแนนรายข้อ
      let rowSum = 0;
      let rowFull = 0;
      row.scores.forEach((s) => {
        if (s === '1') {
          rowSum += 1;
          rowFull += 1;
        } else if (s === '0' || s === 'M') {
          rowFull += 1;
        }
        // 'NA' ในข้อเดี่ยว จะไม่นำมารวมในคะแนนเต็มของข้อนั้น
      });

      // 4. หักคะแนนเฉพาะหมวดที่คู่มือกำหนด (หมวด 12: Nurses' note หัก 1 คะแนน)
      if (row.hasDeductScore && row.deductScore > 0) {
        rowSum -= row.deductScore;
      }
      if (rowSum < 0) rowSum = 0;

      sumScore += rowSum;
      fullScore += rowFull;
    });

    const percentage = fullScore > 0 ? (sumScore / fullScore) * 100 : 0;
    // มาตรฐาน สปสช. IPD: ผู้ป่วยทั่วไป Full score ต้องไม่น้อยกว่า 56 คะแนน, ผู้ป่วยจิตเวช ไม่น้อยกว่า 57 คะแนน
    const minRequiredScore = state.caseType === 'psychiatric' ? 57 : 56;
    const isPassedMinScore = fullScore >= minRequiredScore;
    const isPassed = fullScore >= minRequiredScore && percentage >= 80;

    return {
      sumScore,
      fullScore,
      percentage: Number(percentage.toFixed(2)),
      minRequiredScore,
      isPassedMinScore,
      isPassed,
    };
  },
}));

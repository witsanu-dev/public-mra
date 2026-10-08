export type ScoreValue = '1' | '0' | 'NA' | 'M' | null;

export interface AuditTableRow {
  id: string;
  no: number | string;
  contentName: string;
  isSubRow?: boolean;
  dateStr?: string; // สำหรับบันทึก วันที่ visit เช่น วันที่ตรวจ Follow up ครั้งที่ 1, 2, 3
  naSelected?: boolean;
  missingSelected?: boolean;
  scores: [ScoreValue, ScoreValue, ScoreValue, ScoreValue, ScoreValue, ScoreValue, ScoreValue]; // เกณฑ์ข้อ 1 - 7
  addScore: number; // เพิ่มคะแนน (+1)
  deductScore: number; // หักคะแนน (-1)
  remarkText?: string; // หมายเหตุประจำแถว
  canNA: boolean; // มีสิทธิ์เลือก NA หรือไม่ (เฉพาะ Follow up, Op note, Consent, Rehab)
  hasAddScore?: boolean; // มีเกณฑ์คะแนนเพิ่มพิเศษ (+1) หรือไม่
}

export const initialAuditTableRows: AuditTableRow[] = [
  {
    id: 'c1',
    no: 1,
    contentName: "Patient's Profile",
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: false,
  },
  {
    id: 'c2',
    no: 2,
    contentName: 'History (1st visit)',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: false,
    hasAddScore: true, // +1 กรณีมี PI ครบ 5W, 2H
  },
  {
    id: 'c3',
    no: 3,
    contentName: 'Physical examination/Diagnosis',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: false,
  },
  {
    id: 'c4',
    no: 4,
    contentName: 'Treatment/Investigation',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: false,
    hasAddScore: true, // +1 กรณียานอกบัญชียาหลักแห่งชาติระบุเหตุผล (ภาคผนวก ค.)
  },
  {
    id: 'c5_1',
    no: '5',
    contentName: 'Follow up ครั้งที่ 1',
    isSubRow: true,
    dateStr: '',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
    hasAddScore: true, // +1 กรณียานอกบัญชีฯ
  },
  {
    id: 'c5_2',
    no: '5',
    contentName: 'Follow up ครั้งที่ 2',
    isSubRow: true,
    dateStr: '',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
    hasAddScore: true, // +1 กรณียานอกบัญชีฯ
  },
  {
    id: 'c5_3',
    no: '5',
    contentName: 'Follow up ครั้งที่ 3',
    isSubRow: true,
    dateStr: '',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
    hasAddScore: true, // +1 กรณียานอกบัญชีฯ
  },
  {
    id: 'c6',
    no: 6,
    contentName: 'Operative note',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
  },
  {
    id: 'c7',
    no: 7,
    contentName: 'Informed consent',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
  },
  {
    id: 'c8',
    no: 8,
    contentName: 'Rehabilitation record *',
    scores: [null, null, null, null, null, null, null],
    addScore: 0,
    deductScore: 0,
    remarkText: '',
    canNA: true,
  },
];

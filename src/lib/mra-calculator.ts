/**
 * Medical Record Audit (MRA) Calculation Utilities
 * อ้างอิงตามคู่มือการตรวจประเมินคุณภาพการบันทึกเวชระเบียน สปสช. ปี 2563 (Medical Record Audit Guideline 2563)
 */

import { AuditTableRow } from './mra-table-types';
import { IpdAuditTableRow } from './mra-ipd-types';

export type ScoreValue = '1' | '0' | 'NA' | 'M';

export interface MRAItem {
  id: string;
  category: string;
  description: string;
  score: ScoreValue | null;
  canBeNA: boolean;
}

export type PatientCaseType = 'general' | 'chronic';

export interface ScoreCalculationResult {
  sumScore: number;
  fullScore: number;
  percentage: number;
  minRequiredScore: number;
  isPassedMinScore: boolean;
  isPassed: boolean;
}

export interface OPDScoreResult {
  sumScore: number;
  fullScore: number;
  percentage: number;
  overallFinding: 'inadequate_documentation' | 'no_significant_issue' | 'certain_issues';
}

export const MRA_STANDARDS = {
  // เกณฑ์คะแนนเต็มขั้นต่ำ (Minimum Full Score Requirement)
  OPD_MIN_FULL_SCORE_GENERAL: 14, // คู่มือ สปสช. หน้า 28 ข้อ 5.2.1
  OPD_MIN_FULL_SCORE_CHRONIC: 18, // คู่มือ สปสช. หน้า 28 ข้อ 5.2.2
  IPD_MIN_FULL_SCORE_GENERAL: 56, // คู่มือ สปสช. หน้า 57 ข้อ 1
  IPD_MIN_FULL_SCORE_PSYCHIATRIC: 57, // คู่มือ สปสช. หน้า 116 ข้อ 4
  // เกณฑ์ร้อยละการผ่านการประเมินคุณภาพ
  PASSING_PERCENTAGE_THRESHOLD: 80.0,
};

export class MRACalculator {
  /**
   * คำนวณคะแนน OPD/ER ตามเกณฑ์มาตรฐานคู่มือ สปสช. ปี 2563 (หน้า 28, 39, 85)
   */
  static calculateOpdTableScores(
    rows: AuditTableRow[],
    caseType: 'general' | 'chronic' | 'er' | 'psychiatric'
  ): ScoreCalculationResult {
    let sumScore = 0;
    let fullScore = 0;

    rows.forEach((row) => {
      // 1. หมวดที่เป็น NA จะไม่นำมารวมใน fullScore (คู่มือ หน้า 28 ข้อ 5.2)
      if (row.naSelected) return;

      // 2. หมวดที่เป็น Missing ได้ 0 คะแนน แต่นับคะแนนเต็มเท่ากับจำนวนเกณฑ์ในหมวดนั้น (7 คะแนน)
      if (row.missingSelected) {
        fullScore += 7;
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
        // 'NA' ในข้อเดี่ยว จะไม่นำมารวมใน fullScore
      });

      // 4. คะแนนเพิ่มพิเศษ (+1) ตามคู่มือ (History 5W2H, Treatment ยานอกบัญชีฯ, Follow up ยานอกบัญชีฯ)
      // OPD ไม่มีเกณฑ์หักคะแนนตามคู่มือ
      if (row.hasAddScore && row.addScore > 0) {
        rowSum += row.addScore;
      }

      sumScore += rowSum;
      fullScore += rowFull;
    });

    const percentage = fullScore > 0 ? (sumScore / fullScore) * 100 : 0;
    const isChronic = caseType === 'chronic';
    const minRequiredScore = isChronic
      ? MRA_STANDARDS.OPD_MIN_FULL_SCORE_CHRONIC
      : MRA_STANDARDS.OPD_MIN_FULL_SCORE_GENERAL;

    const isPassedMinScore = fullScore >= minRequiredScore;
    const isPassed = isPassedMinScore && percentage >= MRA_STANDARDS.PASSING_PERCENTAGE_THRESHOLD;

    return {
      sumScore,
      fullScore,
      percentage: Number(percentage.toFixed(2)),
      minRequiredScore,
      isPassedMinScore,
      isPassed,
    };
  }

  /**
   * คำนวณคะแนน IPD ตามเกณฑ์มาตรฐานคู่มือ สปสช. ปี 2563 (หน้า 57, 68, 116, 127)
   */
  static calculateIpdTableScores(
    rows: IpdAuditTableRow[],
    caseType: 'general' | 'psychiatric'
  ): ScoreCalculationResult {
    let sumScore = 0;
    let fullScore = 0;

    rows.forEach((row) => {
      // 1. หมวดที่เป็น NA ไม่นับใน fullScore
      if (row.naSelected) return;

      // 2. หมวดที่เป็น Missing หรือ No ได้ 0 คะแนน และนับคะแนนเต็มเท่ากับจำนวนเกณฑ์สูงสุด (7 หรือ 9)
      if (row.missingSelected || row.noSelected) {
        fullScore += row.maxCriteria || 9;
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
      });

      // 4. หักคะแนน (-1) เฉพาะหมวด 12: Nurses' note กรณีบันทึกไม่ต่อเนื่องทุกวันทุกเวร
      if (row.hasDeductScore && row.deductScore > 0) {
        rowSum -= row.deductScore;
      }
      if (rowSum < 0) rowSum = 0;

      sumScore += rowSum;
      fullScore += rowFull;
    });

    const percentage = fullScore > 0 ? (sumScore / fullScore) * 100 : 0;
    const minRequiredScore =
      caseType === 'psychiatric'
        ? MRA_STANDARDS.IPD_MIN_FULL_SCORE_PSYCHIATRIC
        : MRA_STANDARDS.IPD_MIN_FULL_SCORE_GENERAL;

    const isPassedMinScore = fullScore >= minRequiredScore;
    const isPassed = isPassedMinScore && percentage >= MRA_STANDARDS.PASSING_PERCENTAGE_THRESHOLD;

    return {
      sumScore,
      fullScore,
      percentage: Number(percentage.toFixed(2)),
      minRequiredScore,
      isPassedMinScore,
      isPassed,
    };
  }

  /**
   * Backward-compatible legacy helper
   */
  static calculateOPDScore(items: MRAItem[], patientCase: PatientCaseType): OPDScoreResult {
    let sumScore = 0;
    let fullScore = 0;

    items.forEach((item) => {
      if (item.score === '1') {
        sumScore += 1;
        fullScore += 1;
      } else if (item.score === '0' || item.score === 'M') {
        fullScore += 1;
      }
    });

    const percentage = fullScore > 0 ? (sumScore / fullScore) * 100 : 0;
    let overallFinding: OPDScoreResult['overallFinding'] = 'no_significant_issue';
    if (percentage < 60) {
      overallFinding = 'inadequate_documentation';
    } else if (percentage < 80) {
      overallFinding = 'certain_issues';
    }

    return {
      sumScore,
      fullScore,
      percentage: Number(percentage.toFixed(2)),
      overallFinding,
    };
  }

  static getOPDTemplate(): MRAItem[] {
    return [
      { id: 'opd_1_1', category: '1. Patient Profile', description: 'มีข้อมูลชื่อ นามสกุล เพศ อายุ หรือวันเดือนปีเกิดของผู้ป่วย', score: null, canBeNA: false },
      { id: 'opd_1_2', category: '1. Patient Profile', description: 'มีข้อมูลที่อยู่ปัจจุบัน และเลขประจำตัวประชาชน (หรือเลขที่ใบต่างด้าว/พาสปอร์ต)', score: null, canBeNA: false },
      { id: 'opd_1_3', category: '1. Patient Profile', description: 'มีข้อมูลชื่อ-นามสกุลญาติ หรือผู้ติดต่อฉุกเฉิน พร้อมระบุความสัมพันธ์ และที่อยู่/โทรศัพท์', score: null, canBeNA: false },
      { id: 'opd_1_4', category: '1. Patient Profile', description: 'มีข้อมูลประวัติการแพ้ยาและแพ้อื่นๆ พร้อมระบุสิ่งที่แพ้ หรือระบุว่า "ปฏิเสธ"', score: null, canBeNA: false },
      { id: 'opd_1_5', category: '1. Patient Profile', description: 'มีข้อมูลหมู่เลือด หรือบันทึกว่า "ไม่ทราบ/ไม่เคยตรวจ"', score: null, canBeNA: false },
      { id: 'opd_1_6', category: '1. Patient Profile', description: 'มีวันเดือนปีที่บันทึกข้อมูล ชื่อและนามสกุลผู้รับผิดชอบที่สามารถระบุตัวตนได้', score: null, canBeNA: false },
      { id: 'opd_1_7', category: '1. Patient Profile', description: 'มีชื่อ นามสกุล และ HN ทุกหน้าของเวชระเบียนที่มีบันทึกการรักษา', score: null, canBeNA: false },
    ];
  }
}

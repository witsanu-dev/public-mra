import { create } from 'zustand';
import { initialAuditTableRows, AuditTableRow, ScoreValue } from '@/lib/mra-table-types';

export interface CriteriaItem {
  id: string;
  rowId: string;
  criteriaIndex: number;
  category: string;
  criteriaNo: number;
  title: string;
  description: string;
  canBeNA: boolean;
}

export const allOpdCriteriaList: CriteriaItem[] = [
  // 1. Patient's Profile
  {
    id: 'c1_1',
    rowId: 'c1',
    criteriaIndex: 0,
    category: "1. Patient's profile",
    criteriaNo: 1,
    title: 'ข้อมูลชื่อ-นามสกุล เพศ HN อายุ',
    description: 'มีข้อมูลผู้ป่วยถูกต้อง ครบถ้วน ได้แก่ ข้อมูลชื่อ นามสกุล เพศ (หรือคำนำหน้าชื่อ) HN และอายุ หรือวัน เดือน ปีเกิดของผู้ป่วย (กรณีไม่ทราบวันเดือนเกิดอนุโลมให้มีเฉพาะปี พ.ศ.ได้ / กรณีไม่ทราบชื่อระบุ "ชายหรือหญิงไม่ทราบชื่อ")',
    canBeNA: false,
  },
  {
    id: 'c1_2',
    rowId: 'c1',
    criteriaIndex: 1,
    category: "1. Patient's profile",
    criteriaNo: 2,
    title: 'ที่อยู่ปัจจุบัน และเลขบัตรประชาชน',
    description: 'มีข้อมูลที่อยู่ปัจจุบันและข้อมูลเลขประจำตัวประชาชน 13 หลักของผู้ป่วย หรือเลขที่ใบต่างด้าว/หนังสือเดินทาง (กรณีไม่รู้สึกตัว/เสียชีวิตไม่พบหลักฐานให้ระบุไว้ชัดเจน)',
    canBeNA: false,
  },
  {
    id: 'c1_3',
    rowId: 'c1',
    criteriaIndex: 2,
    category: "1. Patient's profile",
    criteriaNo: 3,
    title: 'ชื่อ-นามสกุลญาติ และเบอร์ติดต่อฉุกเฉิน',
    description: 'มีข้อมูลชื่อและนามสกุลของญาติ หรือผู้ที่ติดต่อได้ในกรณีฉุกเฉิน โดยระบุความสัมพันธ์กับผู้ป่วย และที่อยู่หรือหมายเลขโทรศัพท์ที่ติดต่อได้ (กรณีที่อยู่เดียวกันอาจบันทึก บดก.)',
    canBeNA: false,
  },
  {
    id: 'c1_4',
    rowId: 'c1',
    criteriaIndex: 3,
    category: "1. Patient's profile",
    criteriaNo: 4,
    title: 'ประวัติการแพ้ยาและแพ้อื่นๆ',
    description: 'มีข้อมูลประวัติการแพ้ยาและประวัติการแพ้อื่นๆ พร้อมระบุยาหรือสิ่งที่แพ้ หรือ "ปฏิเสธ" การแพ้ยา/แพ้อื่นๆ หรือมีข้อความที่สื่อความหมายว่าได้มีการซักประวัติแพ้ยา',
    canBeNA: false,
  },
  {
    id: 'c1_5',
    rowId: 'c1',
    criteriaIndex: 4,
    category: "1. Patient's profile",
    criteriaNo: 5,
    title: 'ข้อมูลหมู่เลือด',
    description: 'มีข้อมูลหมู่เลือด หรือบันทึกว่า "ไม่ทราบ" หรือ "ไม่เคยตรวจหมู่เลือด"',
    canBeNA: false,
  },
  {
    id: 'c1_6',
    rowId: 'c1',
    criteriaIndex: 5,
    category: "1. Patient's profile",
    criteriaNo: 6,
    title: 'ว/ด/ป ผู้รับผิดชอบบันทึกข้อมูล',
    description: 'มีข้อมูลวันเดือนปีที่บันทึกข้อมูล ชื่อ และนามสกุลผู้รับผิดชอบในการบันทึกข้อมูล ที่สามารถระบุได้ว่าเป็นผู้ใด',
    canBeNA: false,
  },
  {
    id: 'c1_7',
    rowId: 'c1',
    criteriaIndex: 6,
    category: "1. Patient's profile",
    criteriaNo: 7,
    title: 'ชื่อ นามสกุล และ HN ทุกหน้า',
    description: 'มีข้อมูลชื่อ นามสกุล และ HN ทุกหน้าของเวชระเบียนที่มีการบันทึกข้อมูลการรักษา (กรณี EMR ต้องมีทุกหน้าที่ส่งตรวจ)',
    canBeNA: false,
  },

  // 2. History
  {
    id: 'c2_1',
    rowId: 'c2',
    criteriaIndex: 0,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 1,
    title: 'Chief Complaint (CC)',
    description: 'มีบันทึก chief complaint: อาการและระยะเวลา หรือปัญหาที่ผู้ป่วยต้องมาโรงพยาบาล',
    canBeNA: false,
  },
  {
    id: 'c2_2',
    rowId: 'c2',
    criteriaIndex: 1,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 2,
    title: 'Present Illness (PI)',
    description: 'มีบันทึก present illness ในส่วนของอาการแสดงและการรักษาที่ได้มาแล้ว (กรณีผู้ป่วยนอกโรคทั่วไป) หรือประวัติการรักษาที่ผ่านมา (กรณีโรคเรื้อรังที่เคยรักษาที่อื่น) หากไม่ได้รักษาที่ใดมาก่อนระบุ "ไม่ได้รักษาจากที่ใด"',
    canBeNA: false,
  },
  {
    id: 'c2_3',
    rowId: 'c2',
    criteriaIndex: 2,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 3,
    title: 'Underlying Disease',
    description: 'มีบันทึก underlying disease และการรักษาที่ได้รับอยู่ในปัจจุบัน (หากไม่มีต้องระบุ "ไม่มี..." หรือข้อความที่แสดงว่าได้ซักประวัติแล้ว)',
    canBeNA: true,
  },
  {
    id: 'c2_4',
    rowId: 'c2',
    criteriaIndex: 3,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 4,
    title: 'Past Illness / ประวัติครอบครัว',
    description: 'มีบันทึกประวัติการเจ็บป่วยในอดีตที่สำคัญ (past illness) และหรือ ประวัติความเจ็บป่วยในครอบครัว ที่เกี่ยวข้องกับปัญหาที่มา หรือสอดคล้องกับปัญหาที่สงสัย',
    canBeNA: true,
  },
  {
    id: 'c2_5',
    rowId: 'c2',
    criteriaIndex: 4,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 5,
    title: 'ประวัติแพ้ยาในครั้งนี้',
    description: 'มีบันทึกประวัติการแพ้ยาและประวัติการแพ้อื่นๆ พร้อมระบุชื่อยาหรือสิ่งที่แพ้ (กรณีซักประวัติไม่ได้ระบุ NA)',
    canBeNA: true,
  },
  {
    id: 'c2_6',
    rowId: 'c2',
    criteriaIndex: 5,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 6,
    title: 'ประวัติอื่นๆ (Family/Social/วัคซีน/ปจด.)',
    description: 'บันทึก Family/Personal/Social history, ประวัติประจำเดือน (หญิง 11-60 ปี), ประวัติวัคซีนและพัฒนาการ (เด็ก 0-14 ปี)',
    canBeNA: true,
  },
  {
    id: 'c2_7',
    rowId: 'c2',
    criteriaIndex: 6,
    category: '2. History (ประวัติการเจ็บป่วย)',
    criteriaNo: 7,
    title: 'ประวัติสารเสพติด/บุหรี่/สุรา',
    description: 'มีบันทึกประวัติการใช้สารเสพติดหรือการสูบบุหรี่ หรือการดื่มสุรา โดยระบุจำนวน ความถี่ และระยะเวลาที่ใช้ (เด็ก 0-14 ปี ซักประวัติบุคคลในครอบครัว)',
    canBeNA: true,
  },

  // 3. Physical examination / Diagnosis
  {
    id: 'c3_1',
    rowId: 'c3',
    criteriaIndex: 0,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 1,
    title: 'วันเดือนปี และเวลาประเมินแรกรับ',
    description: 'มีบันทึกวันเดือนปี และเวลาที่ผู้ป่วยได้รับการประเมินครั้งแรก',
    canBeNA: false,
  },
  {
    id: 'c3_2',
    rowId: 'c3',
    criteriaIndex: 1,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 2,
    title: 'ตรวจร่างกาย (ดู หรือ เคาะ)',
    description: 'มีบันทึกการตรวจร่างกายโดยการ ดู หรือ เคาะ ที่นำไปสู่การวินิจฉัยที่สอดคล้องกับ CC มีบันทึกรายงานผลสิ่งที่ตรวจพบปกติ หรือผิดปกติ',
    canBeNA: true,
  },
  {
    id: 'c3_3',
    rowId: 'c3',
    criteriaIndex: 2,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 3,
    title: 'ตรวจร่างกาย (คลำ หรือ ฟัง)',
    description: 'มีบันทึกการตรวจร่างกายโดยการ คลำ หรือ ฟัง ที่นำไปสู่การวินิจฉัยที่สอดคล้องกับ CC มีบันทึกรายงานผลสิ่งที่ตรวจพบปกติ หรือผิดปกติ',
    canBeNA: true,
  },
  {
    id: 'c3_4',
    rowId: 'c3',
    criteriaIndex: 3,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 4,
    title: 'สัญญาณชีพ (PR, RR, Temp)',
    description: 'มีบันทึก pulse rate, respiration rate และ temperature ทุกราย (กรณีญาติรับยาแทนระบุ NA)',
    canBeNA: true,
  },
  {
    id: 'c3_5',
    rowId: 'c3',
    criteriaIndex: 4,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 5,
    title: 'ความดันโลหิต (Blood Pressure)',
    description: 'มีบันทึก Blood Pressure ทุกราย ยกเว้นในเด็กเล็กอายุน้อยกว่า 5 ปีให้พิจารณาตามสภาพปัญหาของผู้ป่วย',
    canBeNA: true,
  },
  {
    id: 'c3_6',
    rowId: 'c3',
    criteriaIndex: 5,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 6,
    title: 'น้ำหนัก และส่วนสูง',
    description: 'มีบันทึกน้ำหนักทุกราย (กรณีชั่งไม่ได้ต้องระบุเหตุผล) และบันทึกส่วนสูงในเด็กทุกราย หรือผู้ใหญ่กรณีใช้คำนวณ BMI/BSA',
    canBeNA: true,
  },
  {
    id: 'c3_7',
    rowId: 'c3',
    criteriaIndex: 6,
    category: '3. Physical examination / Diagnosis',
    criteriaNo: 7,
    title: 'สรุปการวินิจฉัยโรค (Clinical term)',
    description: 'บันทึกการวินิจฉัยเป็นคำวินิจฉัยโรค (clinical term) ไม่บันทึกเป็นรหัส ICD-10 เพียงอย่างเดียว และสอดคล้องกับผลการซักประวัติตรวจร่างกาย',
    canBeNA: false,
  },

  // 4. Treatment / Investigation
  {
    id: 'c4_1',
    rowId: 'c4',
    criteriaIndex: 0,
    category: '4. Treatment / Investigation',
    criteriaNo: 1,
    title: 'สั่งตรวจและผลตรวจทางห้องปฏิบัติการ/รังสี',
    description: 'มีบันทึกการสั่ง และมีผลการตรวจ Lab หรือ X-ray หรือการตรวจอื่นๆ (สั่งตรวจอาจอยู่ครั้งก่อนหน้าได้)',
    canBeNA: true,
  },
  {
    id: 'c4_2',
    rowId: 'c4',
    criteriaIndex: 1,
    category: '4. Treatment / Investigation',
    criteriaNo: 2,
    title: 'การรักษา/สั่งยา/หัตถการ สอดคล้องกับโรค',
    description: 'มีบันทึกการให้การรักษา การสั่งยา การทำหัตถการ (ถ้ามี) ที่สอดคล้องกับการวินิจฉัย ยกเว้นกรณีแพทย์รับผู้ป่วย admit ต้องมีบันทึก admit',
    canBeNA: false,
  },
  {
    id: 'c4_3',
    rowId: 'c4',
    criteriaIndex: 2,
    category: '4. Treatment / Investigation',
    criteriaNo: 3,
    title: 'รายละเอียดคำสั่งยาครบถ้วน',
    description: 'มีบันทึกการสั่งยาที่ระบุรายละเอียด ชื่อยา ความแรง ขนาดที่ใช้ และจำนวนยาที่สั่งจ่าย หรือจำนวนวันที่สั่งจ่ายครบถ้วน',
    canBeNA: true,
  },
  {
    id: 'c4_4',
    rowId: 'c4',
    criteriaIndex: 3,
    category: '4. Treatment / Investigation',
    criteriaNo: 4,
    title: 'คำแนะนำการปฏิบัติตัวและข้อควรระวังยา',
    description: 'มีบันทึกการให้คำแนะนำเกี่ยวกับโรค หรือภาวะการเจ็บป่วย หรือการปฏิบัติตัว หรือการสังเกตอาการผิดปกติ หรือข้อควรระวังเกี่ยวกับยา',
    canBeNA: false,
  },
  {
    id: 'c4_5',
    rowId: 'c4',
    criteriaIndex: 4,
    category: '4. Treatment / Investigation',
    criteriaNo: 5,
    title: 'ผลการปรึกษาระหว่างแผนก (Consultation)',
    description: 'กรณีมีการปรึกษาระหว่างแผนก ต้องมีการบันทึกผลการตรวจวินิจฉัย หรือการรักษาที่ผ่านมา (ถ้าไม่มีส่งปรึกษาระบุ NA)',
    canBeNA: true,
  },
  {
    id: 'c4_6',
    rowId: 'c4',
    criteriaIndex: 5,
    category: '4. Treatment / Investigation',
    criteriaNo: 6,
    title: 'แผนการดูแลต่อเนื่อง หรือการนัดหมาย',
    description: 'มีบันทึกแผนการดูแลรักษาต่อเนื่อง หรือการนัดมาติดตามการรักษา',
    canBeNA: true,
  },
  {
    id: 'c4_7',
    rowId: 'c4',
    criteriaIndex: 6,
    category: '4. Treatment / Investigation',
    criteriaNo: 7,
    title: 'ลายมือชื่อแพทย์/ผู้ตรวจรักษา',
    description: 'บันทึกด้วยลายมือที่อ่านออกได้ และลงลายมือชื่อแพทย์หรือผู้รับผิดชอบในการตรวจรักษาโดยสามารถระบุได้ว่าเป็นผู้ใด',
    canBeNA: false,
  },

  // 5. Follow up ครั้งที่ 1
  {
    id: 'c5_1_1',
    rowId: 'c5_1',
    criteriaIndex: 0,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 1,
    title: 'ประวัติ/เหตุผลในการมา follow up',
    description: 'มีการบันทึกประวัติ หรือเหตุผลในการมา follow up',
    canBeNA: true,
  },
  {
    id: 'c5_1_2',
    rowId: 'c5_1',
    criteriaIndex: 1,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 2,
    title: 'การวินิจฉัยโรคสอดคล้องกับการรักษา',
    description: 'มีการบันทึกการวินิจฉัยโรค ที่สอดคล้องกับการรักษาที่ให้',
    canBeNA: true,
  },
  {
    id: 'c5_1_3',
    rowId: 'c5_1',
    criteriaIndex: 2,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 3,
    title: 'Vital signs และการตรวจร่างกายที่จำเป็น',
    description: 'มีบันทึก vital signs ในส่วนที่เกี่ยวข้อง และหรือการตรวจร่างกายที่จำเป็น (ดู คลำ เคาะ ฟัง)',
    canBeNA: true,
  },
  {
    id: 'c5_1_4',
    rowId: 'c5_1',
    criteriaIndex: 3,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 4,
    title: 'ประเมินผลการรักษา (Evaluation) / แผนรักษา',
    description: 'มีบันทึกการประเมินผลการรักษาในครั้งที่ผ่านมา (evaluation) หรือสรุปปัญหาที่เกิดขึ้น และมีบันทึกการรักษาที่ให้ในครั้งนี้',
    canBeNA: true,
  },
  {
    id: 'c5_1_5',
    rowId: 'c5_1',
    criteriaIndex: 4,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 5,
    title: 'สั่งตรวจและผลตรวจ Lab/X-ray ในครั้งนี้',
    description: 'มีบันทึกการสั่ง และมีผลการตรวจทางห้องปฏิบัติการ หรือการตรวจทางรังสี หรือตรวจอื่นๆ',
    canBeNA: true,
  },
  {
    id: 'c5_1_6',
    rowId: 'c5_1',
    criteriaIndex: 5,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 6,
    title: 'คำแนะนำการปฏิบัติตัว/นัดติดตามครั้งต่อไป',
    description: 'มีบันทึกการให้คำแนะนำเกี่ยวกับการปฏิบัติตัว หรือการสังเกตอาการผิดปกติ หรือข้อควรระวังยา แผนดูแลต่อเนื่อง หรือการนัดมาติดตามครั้งต่อไป',
    canBeNA: true,
  },
  {
    id: 'c5_1_7',
    rowId: 'c5_1',
    criteriaIndex: 6,
    category: '5. Follow up (การตรวจติดตาม ครั้งที่ 1)',
    criteriaNo: 7,
    title: 'ลายมือชื่อแพทย์/ผู้ตรวจรักษา',
    description: 'บันทึกด้วยลายมือที่อ่านออกได้ และลงลายมือชื่อแพทย์หรือผู้รับผิดชอบในการตรวจรักษาโดยสามารถระบุได้ว่าเป็นผู้ใด',
    canBeNA: true,
  },

  // 6. Operative note
  {
    id: 'c6_1',
    rowId: 'c6',
    criteriaIndex: 0,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 1,
    title: 'ชื่อและนามสกุลผู้ป่วยชัดเจน',
    description: 'มีการบันทึกชื่อ และนามสกุล ผู้ป่วยชัดเจนในเอกสารบันทึกผ่าตัดหรือหัตถการ',
    canBeNA: true,
  },
  {
    id: 'c6_2',
    rowId: 'c6',
    criteriaIndex: 1,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 2,
    title: 'สิ่งที่ตรวจพบ (Operative findings)',
    description: 'มีบันทึกสิ่งที่ตรวจพบจากการผ่าตัดหรือหัตถการ (operative findings)',
    canBeNA: true,
  },
  {
    id: 'c6_3',
    rowId: 'c6',
    criteriaIndex: 2,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 3,
    title: 'วิธีการผ่าตัด (Operative procedures)',
    description: 'มีบันทึกวิธีการทำผ่าตัด หรือหัตถการ (operative procedures)',
    canBeNA: true,
  },
  {
    id: 'c6_4',
    rowId: 'c6',
    criteriaIndex: 3,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 4,
    title: 'วิธีให้ยาชา/ยาระงับความรู้สึก',
    description: 'มีบันทึกวิธีการให้ยาชา หรือยาระงับความรู้สึก',
    canBeNA: true,
  },
  {
    id: 'c6_5',
    rowId: 'c6',
    criteriaIndex: 4,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 5,
    title: 'Post-operative diagnosis / Pathology',
    description: 'มีบันทึกผลการทำผ่าตัดหรือการวินิจฉัยหลังผ่าตัด ภาวะแทรกซ้อน และกรณีตัดชิ้นเนื้อต้องมีบันทึกติดตามผลหรือ "รอผลชิ้นเนื้อ"',
    canBeNA: true,
  },
  {
    id: 'c6_6',
    rowId: 'c6',
    criteriaIndex: 5,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 6,
    title: 'วัน เวลา เริ่มต้นและสิ้นสุดการผ่าตัด',
    description: 'บันทึกวันเดือนปี และเวลา ที่เริ่มต้นและสิ้นสุดการทำผ่าตัดหรือหัตถการ',
    canBeNA: true,
  },
  {
    id: 'c6_7',
    rowId: 'c6',
    criteriaIndex: 6,
    category: '6. Operative note (บันทึกการผ่าตัด/หัตถการ)',
    criteriaNo: 7,
    title: 'ลายมือชื่อแพทย์และเลขที่ ว.',
    description: 'ลงลายมือชื่อแพทย์ผู้ทำหัตถการ ระบุชื่อ นามสกุล และเลขที่ใบอนุญาตประกอบวิชาชีพเวชกรรม',
    canBeNA: true,
  },

  // 7. Informed consent
  {
    id: 'c7_1',
    rowId: 'c7',
    criteriaIndex: 0,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 1,
    title: 'ชื่อ-นามสกุลผู้ป่วยถูกต้องชัดเจน',
    description: 'มีการบันทึกชื่อ และนามสกุล ผู้ป่วยถูกต้องชัดเจนในใบยินยอมรับการรักษา',
    canBeNA: true,
  },
  {
    id: 'c7_2',
    rowId: 'c7',
    criteriaIndex: 1,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 2,
    title: 'ลายมือชื่อผู้ให้ความยินยอมรับการรักษา',
    description: 'มีลายมือชื่อหรือลายพิมพ์นิ้วมือ ชื่อและนามสกุลของผู้รับทราบข้อมูลและยินยอม (กรณี <18 ปี หรือขาดสติสัมปชัญญะมีผู้แทนลงนามถูกต้อง)',
    canBeNA: true,
  },
  {
    id: 'c7_3',
    rowId: 'c7',
    criteriaIndex: 2,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 3,
    title: 'ลายมือชื่อพยานฝ่ายผู้ป่วย',
    description: 'มีลายมือชื่อพยานครบถ้วน โดยระบุชื่อ นามสกุล และความสัมพันธ์กับผู้ป่วย (กรณีมาคนเดียวระบุ "ผู้ป่วยมาคนเดียว")',
    canBeNA: true,
  },
  {
    id: 'c7_4',
    rowId: 'c7',
    criteriaIndex: 3,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 4,
    title: 'เหตุผลและความจำเป็นในการทำผ่าตัด/หัตถการ',
    description: 'มีการบันทึกเหตุผล ความจำเป็นที่ต้องทำการผ่าตัด หรือหัตถการ',
    canBeNA: true,
  },
  {
    id: 'c7_5',
    rowId: 'c7',
    criteriaIndex: 4,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 5,
    title: 'ข้อมูลภาวะแทรกซ้อนที่อาจเกิดขึ้นโดยสังเขป',
    description: 'มีการบันทึกการให้ข้อมูลเกี่ยวกับภาวะแทรกซ้อนที่อาจเกิดขึ้นโดยสังเขป',
    canBeNA: true,
  },
  {
    id: 'c7_6',
    rowId: 'c7',
    criteriaIndex: 5,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 6,
    title: 'ลายมือชื่อผู้ให้ข้อมูลการรักษา/หัตถการ',
    description: 'มีการระบุลายมือชื่อผู้ให้ข้อมูล หรือรายละเอียดของการทำผ่าตัด หรือหัตถการ',
    canBeNA: true,
  },
  {
    id: 'c7_7',
    rowId: 'c7',
    criteriaIndex: 6,
    category: '7. Informed consent (บันทึกยินยอมรับการรักษา)',
    criteriaNo: 7,
    title: 'ว/ด/ป และเวลาที่ยินยอมรับการรักษา',
    description: 'มีการบันทึกระบุ วัน เดือน ปี และเวลา ที่รับทราบและยินยอมให้ทำการรักษา',
    canBeNA: true,
  },
];

export interface UnifiedAuditStore {
  // Hospital and patient metadata
  hcode: string;
  hname: string;
  currentVn: string;
  currentSampleItemId: string | null;
  currentBatchId: string | null;
  patientName: string;
  hn: string;
  pid: string;
  caseType: 'general' | 'chronic';
  isPsychiatric?: boolean; // ปรับโหมดเกณฑ์จิตเวช (OPD หน้า 96)
  diagnosis: string;
  visitDate: string;
  chronicPeriodFrom: string;
  chronicPeriodTo: string;
  firstVisitDate: string;

  isExistingAudit: boolean;
  currentAuditId: string | null;

  // Evaluation outcome
  overallFinding: 'inadequate' | 'no_issue' | 'certain_issues' | null;
  certainIssueRemarks: string;
  auditorName: string;
  auditDate: string;

  // Data rows
  rows: AuditTableRow[];

  // Search filter for criteria view
  searchQuery: string;

  // Actions
  setField: (field: string, value: any) => void;
  setIsPsychiatric: (isPsy: boolean) => void;
  setCriteriaScore: (rowId: string, criteriaIndex: number, score: ScoreValue) => void;
  toggleRowNA: (rowId: string) => void;
  toggleRowMissing: (rowId: string) => void;
  setAddScore: (rowId: string, val: number) => void;
  setDeductScore: (rowId: string, val: number) => void;
  setRowDate: (rowId: string, dateStr: string) => void;
  setRowRemark: (rowId: string, remarkText: string) => void;
  setSearchQuery: (query: string) => void;
  loadSampledVisit: (visit: {
    vn: string;
    hn: string;
    cid?: string;
    patientName?: string;
    diagnosis?: string;
    pdx?: string;
    vstdate?: string;
    caseType?: 'general' | 'chronic';
    isPsychiatric?: boolean;
    itemId?: string;
    batchId?: string;
    hcode?: string;
    hname?: string;
  }) => void;
  loadExistingAudit: (vn: string) => Promise<boolean>;
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

export const useUnifiedAuditStore = create<UnifiedAuditStore>((set, get) => ({
  hcode: '',
  hname: '',
  currentVn: '',
  currentSampleItemId: null,
  currentBatchId: null,
  isExistingAudit: false,
  currentAuditId: null,
  patientName: '',
  hn: '670012345',
  pid: '1100400123456',
  caseType: 'general',
  isPsychiatric: false,
  diagnosis: 'Essential hypertension',
  visitDate: '2569-10-03',
  chronicPeriodFrom: '',
  chronicPeriodTo: '',
  firstVisitDate: '',

  overallFinding: 'no_issue',
  certainIssueRemarks: '',
  auditorName: '',
  auditDate: new Date().toISOString().split('T')[0],

  rows: initialAuditTableRows,
  searchQuery: '',

  setField: (field, value) => set({ [field]: value }),

  setIsPsychiatric: (isPsy: boolean) => {
    set((state) => {
      const updatedRows = state.rows.map((row) => {
        if (row.id === 'c6') {
          return {
            ...row,
            contentName: isPsy
              ? 'Operative note*\nECT / Psychosocial intervention'
              : 'Operative note',
          };
        }
        if (row.id === 'c8') {
          return {
            ...row,
            contentName: isPsy
              ? 'Rehabilitation record*\nผู้ป่วยจิตเวช'
              : 'Rehabilitation record *',
          };
        }
        return row;
      });
      return { isPsychiatric: isPsy, rows: updatedRows };
    });
  },

  setCriteriaScore: (rowId, criteriaIndex, score) => {
    set((state) => ({
      rows: state.rows.map((row) => {
        if (row.id !== rowId) return row;
        const newScores = [...row.scores] as AuditTableRow['scores'];
        newScores[criteriaIndex] = score;
        return {
          ...row,
          scores: newScores,
          naSelected: false,
          missingSelected: false,
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
          scores: nextVal ? [null, null, null, null, null, null, null] : row.scores,
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
          scores: nextVal ? ['0', '0', '0', '0', '0', '0', '0'] : row.scores,
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

  setRowDate: (rowId, dateStr) => {
    set((state) => ({
      rows: state.rows.map((row) =>
        row.id === rowId ? { ...row, dateStr } : row
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

  loadSampledVisit: (visit) => {
    const isChronic = visit.caseType === 'chronic';
    const visitDate = visit.vstdate || new Date().toISOString().split('T')[0];
    
    // Auto-detect psychiatric case if pdx starts with F or explicitly passed
    const isPsy = Boolean(
      visit.isPsychiatric ||
      (visit.pdx && /^F\d/i.test(visit.pdx)) ||
      (visit.diagnosis && /จิตเวช|psychiatric|schizo|depress|bipolar/i.test(visit.diagnosis))
    );

    // Default 1-year period for chronic cases
    let periodFrom = '';
    let periodTo = '';
    if (isChronic && visitDate) {
      const d = new Date(visitDate);
      periodTo = visitDate;
      d.setFullYear(d.getFullYear() - 1);
      periodFrom = d.toISOString().split('T')[0];
    }

    const initialRowsWithPsy = initialAuditTableRows.map((row) => {
      if (row.id === 'c6') {
        return {
          ...row,
          contentName: isPsy
            ? 'Operative note*\nECT / Psychosocial intervention'
            : 'Operative note',
        };
      }
      if (row.id === 'c8') {
        return {
          ...row,
          contentName: isPsy
            ? 'Rehabilitation record*\nผู้ป่วยจิตเวช'
            : 'Rehabilitation record *',
        };
      }
      return row;
    });

    const derivedBatchId = visit.batchId || (visit.itemId ? visit.itemId.replace(/-[0-9]+$/, '') : null) || get().currentBatchId;

    set({
      currentVn: visit.vn,
      currentSampleItemId: visit.itemId || null,
      currentBatchId: derivedBatchId,
      hcode: visit.hcode || get().hcode,
      hname: visit.hname || get().hname,
      hn: visit.hn,
      pid: visit.cid || '',
      patientName: visit.patientName || '',
      caseType: visit.caseType || 'general',
      isPsychiatric: isPsy,
      diagnosis: visit.diagnosis || '',
      visitDate: visitDate,
      chronicPeriodFrom: periodFrom,
      chronicPeriodTo: periodTo,
      firstVisitDate: isChronic ? periodFrom : '',
      rows: initialRowsWithPsy,
    });

    if (visit.vn) {
      get().loadExistingAudit(visit.vn);
    }
  },

  loadExistingAudit: async (vn: string) => {
    if (!vn) return false;
    try {
      const res = await fetch(`/api/mra/audit?vn=${encodeURIComponent(vn)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const audit = json.data;
        const details = audit.details || [];

        const isPsy = Boolean(
          audit.is_psychiatric ||
          audit.isPsychiatric ||
          audit.case_type === 'psychiatric' ||
          audit.caseType === 'psychiatric' ||
          (audit.diagnosis && /จิตเวช|psychiatric|schizo|depress|bipolar/i.test(audit.diagnosis))
        );

        const mappedRows = initialAuditTableRows.map((initialRow) => {
          const match = details.find((d: any) => {
            const sameNo = String(d.content_no) === String(initialRow.no);
            if (!sameNo) return false;
            if (d.content_name === initialRow.contentName) return true;
            if (d.content_name && (d.content_name.includes(initialRow.contentName) || initialRow.contentName.includes(d.content_name))) return true;
            if (!initialRow.isSubRow) return true;
            if (initialRow.id === 'c5_1') return true;
            return false;
          });

          let dynamicName = initialRow.contentName;
          if (initialRow.id === 'c6' && isPsy) {
            dynamicName = 'Operative note*\nECT / Psychosocial intervention';
          } else if (initialRow.id === 'c8' && isPsy) {
            dynamicName = 'Rehabilitation record*\nผู้ป่วยจิตเวช';
          }

          if (!match) return { ...initialRow, contentName: dynamicName };
          let parsedScores = initialRow.scores;
          try {
            let raw = match.scores_json;
            if (typeof raw === 'string') {
              raw = JSON.parse(raw);
            }
            if (Array.isArray(raw)) {
              parsedScores = raw as any;
            } else if (raw && typeof raw === 'object' && Array.isArray(raw.scores)) {
              parsedScores = raw.scores as any;
            }
          } catch {}

          return {
            ...initialRow,
            contentName: dynamicName,
            naSelected: Boolean(match.na_selected),
            missingSelected: Boolean(match.missing_selected),
            scores: parsedScores,
            addScore: Number(match.add_score) || 0,
            deductScore: Number(match.deduct_score) || 0,
            remarkText: match.remark_text || '',
          };
        });

        set({
          isExistingAudit: true,
          currentAuditId: audit.audit_id || audit.auditId || null,
          currentVn: audit.vn || vn || get().currentVn,
          hn: audit.hn || get().hn,
          patientName: audit.patient_name || audit.patientName || get().patientName,
          diagnosis: audit.diagnosis || get().diagnosis,
          caseType: (audit.case_type || audit.caseType || get().caseType || 'general') as any,
          visitDate: audit.visit_date ? String(audit.visit_date).split('T')[0] : (get().visitDate || new Date().toISOString().split('T')[0]),
          isPsychiatric: isPsy,
          overallFinding: audit.overall_finding || audit.overallFinding || 'no_issue',
          certainIssueRemarks: audit.certain_issue_remarks || audit.certainIssueRemarks || '',
          auditorName: audit.auditor_name || audit.auditorName || get().auditorName || '',
          auditDate: audit.audit_date ? String(audit.audit_date).split('T')[0] : new Date().toISOString().split('T')[0],
          chronicPeriodFrom: audit.chronic_period_from ? String(audit.chronic_period_from).split('T')[0] : get().chronicPeriodFrom,
          chronicPeriodTo: audit.chronic_period_to ? String(audit.chronic_period_to).split('T')[0] : get().chronicPeriodTo,
          firstVisitDate: audit.first_visit_date ? String(audit.first_visit_date).split('T')[0] : get().firstVisitDate,
          rows: mappedRows,
        });
        return true;
      }
      set({ isExistingAudit: false, currentAuditId: null });
      return false;
    } catch (err) {
      console.error('Error loading existing audit:', err);
      set({ isExistingAudit: false, currentAuditId: null });
      return false;
    }
  },

  revokeAudit: async () => {
    const { currentVn, currentSampleItemId, currentAuditId } = get();
    if (!currentVn && !currentSampleItemId && !currentAuditId) return false;

    try {
      const params = new URLSearchParams();
      if (currentVn) params.set('vn', currentVn);
      if (currentSampleItemId) params.set('itemId', currentSampleItemId);
      if (currentAuditId) params.set('auditId', currentAuditId);

      const res = await fetch(`/api/mra/audit?${params.toString()}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        set({
          isExistingAudit: false,
          currentAuditId: null,
          overallFinding: 'no_issue',
          certainIssueRemarks: '',
          rows: initialAuditTableRows,
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error revoking OPD audit:', err);
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

  resetAll: () =>
    set({
      // Keep the hospital of this installation (loaded from HIS)
      currentVn: '',
      currentSampleItemId: null,
      currentBatchId: null,
      isExistingAudit: false,
      currentAuditId: null,
      patientName: '',
      hn: '',
      pid: '',
      caseType: 'general',
      diagnosis: '',
      visitDate: '',
      chronicPeriodFrom: '',
      chronicPeriodTo: '',
      firstVisitDate: '',
      overallFinding: 'no_issue',
      certainIssueRemarks: '',
      rows: initialAuditTableRows,
      searchQuery: '',
    }),

  calculateTotals: () => {
    const { rows, caseType } = get();
    let sumScore = 0;
    let fullScore = 0;

    rows.forEach((row) => {
      if (row.naSelected) return;

      if (row.missingSelected) {
        fullScore += 7;
        return;
      }

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

      rowSum += row.addScore;
      rowSum -= row.deductScore;
      if (rowSum < 0) rowSum = 0;

      sumScore += rowSum;
      fullScore += rowFull;
    });

    const percentage = fullScore > 0 ? (sumScore / fullScore) * 100 : 0;
    const minRequiredScore = caseType === 'general' ? 14 : 18;
    const isPassed = fullScore >= minRequiredScore && percentage >= 80;

    return {
      sumScore,
      fullScore,
      percentage: Number(percentage.toFixed(2)),
      minRequiredScore,
      isPassedMinScore: fullScore >= minRequiredScore,
      isPassed,
    };
  },
}));

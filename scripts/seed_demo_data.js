const mysql = require('mysql2/promise');

const LOCAL_DB_CONFIG = {
  host: process.env.MRA_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.MRA_DB_PORT || '3306', 10),
  database: process.env.MRA_DB_DATABASE || 'db_mra',
  user: process.env.MRA_DB_USER || 'root',
  password: process.env.MRA_DB_PASSWORD || 'password',
  charset: 'utf8mb4',
};

const OPD_CATEGORIES = [
  { no: 1, name: "Patient's Profile", full: 7 },
  { no: 2, name: 'History (1st visit)', full: 7 },
  { no: 3, name: 'Physical examination/Diagnosis', full: 7 },
  { no: 4, name: 'Treatment/Investigation', full: 7 },
  { no: 5, name: 'Follow up ครั้งที่ 1', full: 7 },
  { no: 6, name: 'Operative note', full: 7 },
  { no: 7, name: 'Informed consent', full: 7 },
  { no: 8, name: 'Rehabilitation record', full: 7 },
];

const IPD_CATEGORIES = [
  { no: 1, name: 'Discharge summary (การวินิจฉัยโรคและหัตถการ)', full: 7 },
  { no: 2, name: 'Discharge summary (ข้อมูลทั่วไปและแผนการรักษา)', full: 7 },
  { no: 3, name: 'Informed consent (หนังสือแสดงความยินยอม)', full: 7 },
  { no: 4, name: 'History (ประวัติการเจ็บป่วยแรกรับ)', full: 7 },
  { no: 5, name: 'Physical examination (การตรวจร่างกายแรกรับ)', full: 7 },
  { no: 6, name: 'Progress note (บันทึกความก้าวหน้าการรักษา)', full: 7 },
  { no: 7, name: 'Consultation record (บันทึกการปรึกษา)', full: 7 },
  { no: 8, name: 'Anesthetic record (บันทึกการระงับความรู้สึก)', full: 7 },
  { no: 9, name: 'Operative note (บันทึกการผ่าตัด)', full: 7 },
  { no: 10, name: 'Labour & Delivery record (บันทึกการคลอด)', full: 7 },
  { no: 11, name: 'Rehabilitation record (บันทึกการฟื้นฟู)', full: 7 },
  { no: 12, name: "Nurses' note (บันทึกทางการพยาบาล)", full: 7 },
];

const THAI_FIRSTNAMES = ['สมชาย', 'สมศักดิ์', 'มาลี', 'วิภา', 'ประเสริฐ', 'กานดา', 'ธีระ', 'สุชาติ', 'นภา', 'บุญมี', 'อำนาจ', 'รัตนา', 'วีระ', 'ศิริพร', 'พิเชษฐ์', 'ดวงใจ', 'อดิศักดิ์', 'ชูชาติ', 'พิมพา', 'ชวนชม'];
const THAI_LASTNAMES = ['ใจดี', 'รักชาติ', 'มีสุข', 'สุขใจ', 'สมบูรณ์', 'วัฒนา', 'ศรีทอง', 'วงศ์สุวรรณ', 'ทองมี', 'พงษ์เพชร', 'เจริญสุข', 'มั่นคง', 'ประสิทธิ์', 'แสงดาว', 'ดวงมณี', 'สุขเกษม', 'บุญเรือง', 'ชัยชนะ', 'สว่างวงค์', 'เกษมสุข'];

const DOCTOR_NAMES = [
  'นพ. ตรวจสอบ เวชระเบียน',
  'พญ. ศิริพร แพทย์ชำนาญการ',
  'นพ. เกรียงไกร อายุรแพทย์',
  'พญ. มัทนา สถิติเวชกรรม',
  'นพ. พิสิษฐ์ จิตแพทย์ประจำ รพ.'
];

const OPD_DIAGNOSES = [
  { pdx: 'J06.9', name: 'Acute upper respiratory infection, unspecified', dept: 'แผนกตรวจโรคทั่วไป' },
  { pdx: 'E11.9', name: 'Type 2 diabetes mellitus without complications', dept: 'คลินิกโรคเบาหวาน' },
  { pdx: 'I10', name: 'Essential (primary) hypertension', dept: 'คลินิกความดันโลหิตสูง' },
  { pdx: 'K29.7', name: 'Gastritis, unspecified', dept: 'แผนกตรวจโรคทั่วไป' },
  { pdx: 'S00.9', name: 'Superficial injury of head, part unspecified', dept: 'แผนกอุบัติเหตุ-ฉุกเฉิน' },
  { pdx: 'F32.9', name: 'Depressive episode, unspecified', dept: 'คลินิกจิตเวช' },
  { pdx: 'F41.9', name: 'Anxiety disorder, unspecified', dept: 'คลินิกจิตเวช' },
  { pdx: 'M54.5', name: 'Low back pain', dept: 'แผนกศัลยกรรมกระดูก' },
  { pdx: 'N39.0', name: 'Urinary tract infection, site not specified', dept: 'แผนกตรวจโรคทั่วไป' },
  { pdx: 'J45.9', name: 'Asthma, unspecified', dept: 'คลินิกโรคระบบทางเดินหายใจ' },
];

const IPD_DIAGNOSES = [
  { pdx: 'J18.9', name: 'Pneumonia, unspecified', wardCode: '01', wardName: 'หอผู้ป่วยอายุรกรรม' },
  { pdx: 'K35.8', name: 'Other and unspecified acute appendicitis', wardCode: '02', wardName: 'หอผู้ป่วยศัลยกรรม' },
  { pdx: 'E11.6', name: 'Type 2 diabetes mellitus with other specified complications', wardCode: '01', wardName: 'หอผู้ป่วยอายุรกรรม' },
  { pdx: 'A09.9', name: 'Gastroenteritis and colitis of unspecified origin', wardCode: '03', wardName: 'หอผู้ป่วยกุมารเวชกรรม' },
  { pdx: 'I21.9', name: 'Acute myocardial infarction, unspecified', wardCode: '01', wardName: 'หอผู้ป่วยอายุรกรรม' },
  { pdx: 'F20.0', name: 'Paranoid schizophrenia', wardCode: '04', wardName: 'หอผู้ป่วยจิตเวช' },
  { pdx: 'O80.0', name: 'Spontaneous vertex delivery', wardCode: '05', wardName: 'หอผู้ป่วยสูติ-นรีเวชกรรม' },
  { pdx: 'S82.2', name: 'Fracture of shaft of tibia', wardCode: '02', wardName: 'หอผู้ป่วยศัลยกรรม' },
  { pdx: 'N18.5', name: 'Chronic kidney disease, stage 5', wardCode: '01', wardName: 'หอผู้ป่วยอายุรกรรม' },
  { pdx: 'J44.1', name: 'Chronic obstructive pulmonary disease with acute exacerbation', wardCode: '01', wardName: 'หอผู้ป่วยอายุรกรรม' },
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedData() {
  console.log('Connecting to db_mra on localhost...');
  const conn = await mysql.createConnection(LOCAL_DB_CONFIG);

  try {
    await conn.query('SET NAMES utf8mb4');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Clean existing mock data
    console.log('Cleaning existing audit & batch tables in db_mra...');
    await conn.query('TRUNCATE TABLE mra_opd_audit_detail');
    await conn.query('TRUNCATE TABLE mra_opd_audit');
    await conn.query('TRUNCATE TABLE mra_sampling_item');
    await conn.query('TRUNCATE TABLE mra_sampling_batch');

    await conn.query('TRUNCATE TABLE mra_ipd_audit_detail');
    await conn.query('TRUNCATE TABLE mra_ipd_audit');
    await conn.query('TRUNCATE TABLE mra_ipd_sampling_item');
    await conn.query('TRUNCATE TABLE mra_ipd_sampling_batch');
    await conn.query("DELETE FROM mra_audit_trail WHERE category = 'AUTH'");

    console.log('✓ Tables cleaned successfully.');

    // ── 1. SEED OPD BATCHES & ITEMS & AUDITS ──
    const opdBatchesDef = [
      {
        batchId: 'OPD-B2610-01',
        batchName: 'สุ่มตรวจผู้ป่วยนอกโรคทั่วไป ประจำงวด ตุลาคม 2569',
        date: '2026-10-02 08:30:00',
        caseType: 'general',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-05',
        count: 20,
        auditedRatio: 0.9, // 18 audited, 2 pending
        deptCode: '01',
        status: 'active',
        note: 'การสุ่มตรวจสัปดาห์แรกของเดือนตุลาคม 2569 กลุ่มโรคทั่วไป',
      },
      {
        batchId: 'OPD-B2610-02',
        batchName: 'สุ่มตรวจคลินิกโรคเรื้อรัง (เบาหวาน/ความดัน) ต.ค. 2569',
        date: '2026-10-03 09:00:00',
        caseType: 'chronic',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
        count: 20,
        auditedRatio: 1.0, // 20 audited (completed)
        deptCode: '02',
        status: 'completed',
        note: 'ตรวจครบถ้วน 100% กลุ่มผู้ป่วยที่มีการ Follow up อย่างน้อย 1 ครั้ง',
      },
      {
        batchId: 'OPD-B2609-01',
        batchName: 'สุ่มตรวจผู้ป่วยฉุกเฉิน (ER) ประจำเดือน กันยายน 2569',
        date: '2026-09-20 10:15:00',
        caseType: 'er',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-15',
        count: 15,
        auditedRatio: 1.0,
        deptCode: 'ER',
        status: 'completed',
        note: 'ตรวจประเมินคุณภาพเวชระเบียนแผนกอุบัติเหตุ-ฉุกเฉิน',
      },
      {
        batchId: 'OPD-B2609-02',
        batchName: 'สุ่มตรวจผู้ป่วยจิตเวช (OPD Psychiatric) ก.ย. 2569',
        date: '2026-09-25 11:00:00',
        caseType: 'psychiatric',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-24',
        count: 15,
        auditedRatio: 0.8, // 12 audited, 3 pending
        deptCode: 'PSY',
        status: 'active',
        note: 'ตรวจตามเกณฑ์คู่มือเวชระเบียนผู้ป่วยจิตเวช สปสช.',
      },
      {
        batchId: 'OPD-B2608-01',
        batchName: 'สุ่มตรวจเวชระเบียนผู้ป่วยนอกประจำเดือน สิงหาคม 2569',
        date: '2026-08-15 09:30:00',
        caseType: 'general',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-14',
        count: 20,
        auditedRatio: 1.0,
        deptCode: '01',
        status: 'completed',
        note: 'สุ่มตรวจประจำเดือนสิงหาคม สรุปผลแล้ว',
      },
    ];

    let vnCounter = 6901001;
    let hnCounter = 120500;

    for (const b of opdBatchesDef) {
      await conn.query(
        `INSERT INTO mra_sampling_batch 
          (batch_id, batch_name, sampling_date, case_type, date_from, date_to, sample_size, total_available, department_code, status, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.batchId,
          b.batchName,
          b.date,
          b.caseType,
          b.dateFrom,
          b.dateTo,
          b.count,
          b.count * 12,
          b.deptCode,
          b.status,
          b.note,
          'นพ. ตรวจสอบ เวชระเบียน',
          b.date,
        ]
      );

      const auditedTarget = Math.round(b.count * b.auditedRatio);

      for (let i = 0; i < b.count; i++) {
        vnCounter++;
        hnCounter++;
        const vn = String(vnCounter);
        const hn = String(hnCounter).padStart(7, '0');
        const itemId = `ITEM-OPD-${vn}`;
        const patientName = `${getRandomItem(THAI_FIRSTNAMES)} ${getRandomItem(THAI_LASTNAMES)}`;
        const sex = i % 2 === 0 ? 'ชาย' : 'หญิง';
        const age = getRandomInt(18, 75);
        const diagObj = b.caseType === 'psychiatric' 
          ? { pdx: 'F32.9', name: 'Major depressive disorder', dept: 'คลินิกจิตเวช' }
          : b.caseType === 'chronic'
          ? { pdx: 'E11.9', name: 'Type 2 Diabetes Mellitus with HT', dept: 'คลินิกโรคเรื้อรัง' }
          : getRandomItem(OPD_DIAGNOSES);
        
        const isAudited = i < auditedTarget;
        const auditStatus = isAudited ? 'audited' : 'pending';
        const auditId = isAudited ? `AUDIT-${vn}-${getRandomInt(1000, 9999)}` : null;
        const auditedAt = isAudited ? b.date : null;

        await conn.query(
          `INSERT INTO mra_sampling_item
            (item_id, batch_id, vn, hn, cid, patient_name, sex, age_y, vstdate, vsttime, department, pdx, diagnosis_name, pttype_name, doctor_name, chief_complaint, audit_status, audit_id, audited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            b.batchId,
            vn,
            hn,
            `1449900${hnCounter}`,
            patientName,
            sex,
            age,
            b.dateFrom,
            '09:15:00',
            diagObj.dept,
            diagObj.pdx,
            diagObj.name,
            'บัตรทอง (สปสช.)',
            getRandomItem(DOCTOR_NAMES),
            'มีอาการมารับบริการตามนัด / ตรวจรักษา',
            auditStatus,
            auditId,
            auditedAt,
          ]
        );

        if (isAudited) {
          // Generate realistic OPD Score
          const isPsychiatric = b.caseType === 'psychiatric' ? 1 : 0;
          const minScoreReq = b.caseType === 'chronic' ? 18 : 14;
          
          // Let 85% pass, 15% fail
          const isPassed = Math.random() < 0.85 ? 1 : 0;
          let percentage = isPassed 
            ? getRandomInt(82, 100) 
            : getRandomInt(50, 78);
          
          let overallFinding = percentage >= 80 ? 'no_issue' : percentage >= 60 ? 'certain_issues' : 'inadequate';
          let remarks = overallFinding === 'certain_issues' ? 'การบันทึก Informed consent ไม่ครบถ้วน' : overallFinding === 'inadequate' ? 'เวชระเบียนขาดลายมือชื่อแพทย์และคำสั่งการรักษา' : '';

          let fullScore = b.caseType === 'chronic' ? 28 : 24;
          let sumScore = Math.round((percentage / 100) * fullScore);

          await conn.query(
            `INSERT INTO mra_opd_audit
              (audit_id, item_id, vn, hn, pid, patient_name, hcode, hname, case_type, is_psychiatric, diagnosis, visit_date, 
               chronic_period_from, chronic_period_to, first_visit_date, sum_score, full_score, percentage, 
               is_passed, overall_finding, certain_issue_remarks, auditor_name, audit_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              itemId,
              vn,
              hn,
              `1449900${hnCounter}`,
              patientName,
              '11078',
              'โรงพยาบาลกมลาไสย',
              b.caseType,
              isPsychiatric,
              diagObj.name,
              b.dateFrom,
              b.caseType === 'chronic' ? b.dateFrom : '',
              b.caseType === 'chronic' ? b.dateTo : '',
              b.caseType === 'chronic' ? '2026-01-10' : '',
              sumScore,
              fullScore,
              percentage,
              isPassed,
              overallFinding,
              remarks,
              getRandomItem(DOCTOR_NAMES),
              b.date.split(' ')[0],
              b.date,
            ]
          );

          // Insert 8 OPD Details
          for (const cat of OPD_CATEGORIES) {
            let na = 0;
            let missing = 0;
            let cFull = 7;
            let cSum = 7;

            // Cat 6,7 (Operative note, Consent) might be NA for general OPD
            if ((cat.no === 6 || cat.no === 7) && b.caseType === 'general') {
              if (Math.random() < 0.6) {
                na = 1;
                cFull = 0;
                cSum = 0;
              }
            }

            if (!na) {
              if (!isPassed && Math.random() < 0.4) {
                // missing or defective
                if (Math.random() < 0.5) missing = 1;
                cSum = getRandomInt(2, 5);
              } else {
                cSum = getRandomInt(6, 7);
              }
            }

            let scoresArr = [null, null, null, null, null, null, null];
            if (na) {
              scoresArr = [null, null, null, null, null, null, null];
            } else if (missing) {
              scoresArr = ['0', '0', '0', '0', '0', '0', '0'];
            } else {
              scoresArr = [];
              for (let k = 0; k < 7; k++) {
                scoresArr.push(k < cSum ? '1' : '0');
              }
            }

            await conn.query(
              `INSERT INTO mra_opd_audit_detail
                (audit_id, content_no, content_name, na_selected, missing_selected, scores_json, add_score, deduct_score, calculated_full, calculated_sum, remark_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                auditId,
                cat.no,
                cat.name,
                na,
                missing,
                JSON.stringify(scoresArr),
                0,
                0,
                cFull,
                cSum,
                missing ? 'เอกสารสูญหายหรือไม่ครบ' : '',
              ]
            );
          }
        }
      }
    }
    console.log('✓ Seeded 5 OPD Batches with 90 items and detailed audits.');

    // ── 2. SEED IPD BATCHES & ITEMS & AUDITS ──
    const ipdBatchesDef = [
      {
        batchId: 'IPD-B2610-01',
        batchName: 'สุ่มตรวจผู้ป่วยใน หอผู้ป่วยอายุรกรรม ต.ค. 2569',
        date: '2026-10-02 11:30:00',
        caseType: 'general',
        wardCode: '01',
        wardName: 'หอผู้ป่วยอายุรกรรม',
        dateFrom: '2026-09-20',
        dateTo: '2026-10-01',
        count: 15,
        auditedRatio: 0.87, // 13 audited, 2 pending
        status: 'active',
        note: 'สุ่มตรวจเคสผู้ป่วยในที่จำหน่าย หอผู้ป่วยอายุรกรรม',
      },
      {
        batchId: 'IPD-B2610-02',
        batchName: 'สุ่มตรวจผู้ป่วยใน หอผู้ป่วยศัลยกรรม ต.ค. 2569',
        date: '2026-10-03 14:00:00',
        caseType: 'general',
        wardCode: '02',
        wardName: 'หอผู้ป่วยศัลยกรรม',
        dateFrom: '2026-09-15',
        dateTo: '2026-09-30',
        count: 15,
        auditedRatio: 1.0, // 15 audited (completed)
        status: 'completed',
        note: 'ตรวจครบ 15 ชาร์ต เคสผ่าตัดและหัตถการศัลยกรรม',
      },
      {
        batchId: 'IPD-B2609-01',
        batchName: 'สุ่มตรวจผู้ป่วยใน หอผู้ป่วยกุมารเวชกรรม ก.ย. 2569',
        date: '2026-09-18 13:00:00',
        caseType: 'general',
        wardCode: '03',
        wardName: 'หอผู้ป่วยกุมารเวชกรรม',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-15',
        count: 12,
        auditedRatio: 1.0,
        status: 'completed',
        note: 'ตรวจประเมินเวชระเบียนผู้ป่วยเด็ก',
      },
      {
        batchId: 'IPD-B2609-02',
        batchName: 'สุ่มตรวจผู้ป่วยใน หอผู้ป่วยจิตเวช ก.ย. 2569',
        date: '2026-09-24 15:30:00',
        caseType: 'psychiatric',
        wardCode: '04',
        wardName: 'หอผู้ป่วยจิตเวช',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-22',
        count: 12,
        auditedRatio: 0.83, // 10 audited, 2 pending
        status: 'active',
        note: 'ประเมินเกณฑ์ IPD จิตเวช (Discharge Summary, ECT, Psychosocial)',
      },
      {
        batchId: 'IPD-B2608-01',
        batchName: 'สุ่มตรวจผู้ป่วยใน รวมทุกหอผู้ป่วย ส.ค. 2569',
        date: '2026-08-18 10:00:00',
        caseType: 'general',
        wardCode: '',
        wardName: 'รวมทุกหอผู้ป่วย',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-16',
        count: 15,
        auditedRatio: 1.0,
        status: 'completed',
        note: 'ตรวจครบถ้วนประจำเดือนสิงหาคม',
      },
    ];

    let anCounter = 6900101;

    for (const b of ipdBatchesDef) {
      await conn.query(
        `INSERT INTO mra_ipd_sampling_batch
          (batch_id, batch_name, sampling_date, case_type, date_from, date_to, sample_size, total_available, ward_code, ward_name, status, note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          b.batchId,
          b.batchName,
          b.date,
          b.caseType,
          b.dateFrom,
          b.dateTo,
          b.count,
          b.count * 8,
          b.wardCode || null,
          b.wardName || 'ทุกหอผู้ป่วย',
          b.status,
          b.note,
          'นพ. ตรวจสอบ เวชระเบียน',
          b.date,
        ]
      );

      const auditedTarget = Math.round(b.count * b.auditedRatio);

      for (let i = 0; i < b.count; i++) {
        anCounter++;
        hnCounter++;
        const an = String(anCounter);
        const hn = String(hnCounter).padStart(7, '0');
        const itemId = `ITEM-IPD-${an}`;
        const patientName = `${getRandomItem(THAI_FIRSTNAMES)} ${getRandomItem(THAI_LASTNAMES)}`;
        const sex = i % 2 === 0 ? 'ชาย' : 'หญิง';
        const age = getRandomInt(1, 80);
        const diagObj = b.caseType === 'psychiatric' 
          ? { pdx: 'F20.0', name: 'Paranoid schizophrenia', wardCode: '04', wardName: 'หอผู้ป่วยจิตเวช' }
          : getRandomItem(IPD_DIAGNOSES);

        const isAudited = i < auditedTarget;
        const auditStatus = isAudited ? 'audited' : 'pending';
        const auditId = isAudited ? `IPD-AUDIT-${an}-${getRandomInt(1000, 9999)}` : null;
        const auditedAt = isAudited ? b.date : null;
        const los = getRandomInt(2, 9);

        await conn.query(
          `INSERT INTO mra_ipd_sampling_item
            (item_id, batch_id, an, hn, cid, patient_name, sex, age_y, regdate, regtime, dchdate, dchtime, ward_code, ward_name, pdx, diagnosis_name, pttype_name, dchstts, dchtype, length_of_stay, doctor_name, audit_status, audit_id, audited_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            b.batchId,
            an,
            hn,
            `1449900${hnCounter}`,
            patientName,
            sex,
            age,
            b.dateFrom,
            '10:00:00',
            b.dateTo,
            '14:30:00',
            b.wardCode || diagObj.wardCode,
            b.wardName || diagObj.wardName,
            diagObj.pdx,
            diagObj.name,
            'บัตรทอง (สปสช.)',
            '01 หาย (Recovered)',
            '01 แพทย์อนุญาตให้กลับบ้าน',
            los,
            getRandomItem(DOCTOR_NAMES),
            auditStatus,
            auditId,
            auditedAt,
          ]
        );

        if (isAudited) {
          const isPsychiatric = b.caseType === 'psychiatric' ? 1 : 0;
          const minScoreReq = isPsychiatric ? 57 : 56;
          
          // 88% pass rate
          const isPassed = Math.random() < 0.88 ? 1 : 0;
          let percentage = isPassed 
            ? getRandomInt(81, 98) 
            : getRandomInt(54, 76);

          let overallFinding = percentage >= 80 ? 'no_issue' : percentage >= 60 ? 'certain_issues' : 'inadequate';
          let remarks = overallFinding === 'certain_issues' ? 'การบันทึก Consult หรือ Anesthetic note ขาดการลงเวลา' : '';

          let fullScore = 70; // 10 categories active
          let sumScore = Math.round((percentage / 100) * fullScore);

          await conn.query(
            `INSERT INTO mra_ipd_audit
              (audit_id, item_id, an, hn, patient_name, hcode, hname, case_type, is_psychiatric, ward_code, ward_name, 
               admit_date, discharge_date, length_of_stay, discharge_status, discharge_type, diagnosis, 
               sum_score, full_score, percentage, is_passed, overall_finding, certain_issue_remarks, auditor_name, audit_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              auditId,
              itemId,
              an,
              hn,
              patientName,
              '11078',
              'โรงพยาบาลกมลาไสย',
              b.caseType,
              isPsychiatric,
              b.wardCode || diagObj.wardCode,
              b.wardName || diagObj.wardName,
              `${b.dateFrom} 10:00:00`,
              `${b.dateTo} 14:30:00`,
              los,
              '01 หาย',
              '01 แพทย์อนุญาต',
              diagObj.name,
              sumScore,
              fullScore,
              percentage,
              isPassed,
              overallFinding,
              remarks,
              getRandomItem(DOCTOR_NAMES),
              b.date.split(' ')[0],
              b.date,
            ]
          );

          // Insert 12 IPD Category Details
          for (const cat of IPD_CATEGORIES) {
            let na = 0;
            let missing = 0;
            let cFull = 7;
            let cSum = 7;

            // Categories 7-11 can be NA if no service provided (e.g. Labour, Anesthetic)
            if (cat.no === 8 || cat.no === 9 || cat.no === 10 || cat.no === 11) {
              if (cat.no === 10 && (diagObj.wardCode !== '05' || sex === 'ชาย')) {
                na = 1; // Male or non-OB ward has no Labour record
              } else if (cat.no === 8 && diagObj.wardCode === '01') {
                na = 1; // General Medicine rarely has general anesthesia
              }
            }

            if (na) {
              cFull = 0;
              cSum = 0;
            } else {
              if (!isPassed && Math.random() < 0.35) {
                if (Math.random() < 0.3) missing = 1;
                cSum = getRandomInt(3, 5);
              } else {
                cSum = getRandomInt(6, 7);
              }
            }

            let scoresArr = [null, null, null, null, null, null, null];
            if (na) {
              scoresArr = [null, null, null, null, null, null, null];
            } else if (missing) {
              scoresArr = ['0', '0', '0', '0', '0', '0', '0'];
            } else {
              scoresArr = [];
              for (let k = 0; k < 7; k++) {
                scoresArr.push(k < cSum ? '1' : '0');
              }
            }

            await conn.query(
              `INSERT INTO mra_ipd_audit_detail
                (audit_id, content_no, content_name, na_selected, missing_selected, scores_json, add_score, deduct_score, calculated_full, calculated_sum, remark_text)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                auditId,
                cat.no,
                cat.name,
                na,
                missing,
                JSON.stringify(scoresArr),
                0,
                0,
                cFull,
                cSum,
                missing ? 'ไม่พบเอกสารในแฟ้มเวชระเบียน' : '',
              ]
            );
          }
        }
      }
    }
    console.log('✓ Seeded 5 IPD Batches with 69 items and detailed audits.');

    // ── 3. SEED AUTH LOGS ──
    const authActions = [
      { user: 'witsanu', name: 'วิษณุ ศรีโยธา', role: 'admin', action: 'login', ip: '192.168.1.105', status: 'success' },
      { user: 'auditor', name: 'นพ. ตรวจสอบ เวชระเบียน', role: 'auditor', action: 'login', ip: '192.168.1.112', status: 'success' },
      { user: 'auditor2', name: 'พญ. ศิริพร แพทย์ชำนาญการ', role: 'auditor', action: 'login', ip: '192.168.1.114', status: 'success' },
      { user: 'nurse1', name: 'พว. กานดา มีสุข', role: 'nurse', action: 'login', ip: '192.168.1.120', status: 'success' },
      { user: 'auditor', name: 'นพ. ตรวจสอบ เวชระเบียน', role: 'auditor', action: 'logout', ip: '192.168.1.112', status: 'success' },
      { user: 'test_wrong', name: 'เจ้าหน้าที่ทดสอบ', role: 'officer', action: 'failed', ip: '192.168.1.150', status: 'failed', reason: 'รหัสผ่านไม่ถูกต้อง' },
      { user: 'witsanu', name: 'วิษณุ ศรีโยธา', role: 'admin', action: 'login', ip: '192.168.1.105', status: 'success' },
    ];

    for (const a of authActions) {
      const summary =
        a.action === 'login'
          ? 'เข้าสู่ระบบสำเร็จ'
          : a.action === 'logout'
          ? 'ออกจากระบบ'
          : `เข้าสู่ระบบไม่สำเร็จ: ${a.reason || 'รหัสผ่านหรือข้อมูลไม่ถูกต้อง'}`;
      const normalizedAction = a.action === 'failed' ? 'login_failed' : a.action;
      const severity = a.status === 'success' ? 'info' : 'warning';
      const details = JSON.stringify({ failReason: a.reason || undefined });

      await conn.query(
        `INSERT INTO mra_audit_trail 
          (event_time, category, action, status, severity, actor_loginname, actor_fullname, actor_role, target_type, target_id, summary, details, ip_address, user_agent, request_method, request_path)
         VALUES (NOW(3), 'AUTH', ?, ?, ?, ?, ?, ?, 'user', ?, ?, ?, ?, ?, 'POST', ?)`,
        [
          normalizedAction,
          a.status,
          severity,
          a.user,
          a.name,
          a.role,
          a.user,
          summary,
          details,
          a.ip,
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
          a.action === 'logout' ? '/api/auth/logout' : '/api/auth/login',
        ]
      );
    }
    console.log('✓ Seeded authentication logs.');

    // ── 4. Verify SQL View Outputs ──
    const [execSummary] = await conn.query('SELECT count(*) as cnt, sum(total_audited) as total FROM view_mra_executive_summary');
    const [catSummary] = await conn.query('SELECT count(*) as cnt FROM view_mra_category_performance');

    console.log('\n================ DATA SEEDING COMPLETE ================');
    console.log('view_mra_executive_summary groups:', execSummary[0].cnt, '| Total audited charts in views:', execSummary[0].total);
    console.log('view_mra_category_performance groups:', catSummary[0].cnt);
    console.log('========================================================\n');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.end();
  }
}

seedData();

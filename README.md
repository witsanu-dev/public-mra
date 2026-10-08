# e-MRA (Electronic Medical Record Audit)

> **ระบบประเมินคุณภาพการบันทึกเวชระเบียนอิเล็กทรอนิกส์ตามเกณฑ์มาตรฐาน สปสช. ปี 2563**  
> *Modern Modular Full-Stack Web Application for Clinical Audit & Quality Assurance*

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat&logo=mysql)](https://www.mysql.com/)
[![Security](https://img.shields.io/badge/Security-Hospital--Grade%20PDPA%20%26%20ISO27001-green?style=flat)](https://github.com/witsanu-dev/mra)

---

## 📋 บทสรุปภาพรวมระบบ (Executive Summary)

**ระบบ e-MRA (Electronic Medical Record Audit)** ได้รับการวิจัยและพัฒนาขึ้นเพื่อยกระดับกระบวนการตรวจสอบคุณภาพการบันทึกเวชระเบียนของหน่วยบริการสุขภาพ จากกระบวนการตรวจสอบแบบเอกสารกระดาษ (Manual Paper-based) สู่ระบบดิจิทัลอัจฉริยะที่แม่นยำ ปลอดภัย และมีประสิทธิภาพสูง ออกแบบตามเกณฑ์มาตรฐานคู่มือการตรวจสอบเวชระเบียนของสำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) ปี 2563 อย่างเคร่งครัด

ระบบมีจุดเด่นในการประมวลผลด้วยสถาปัตยกรรม **Hybrid Dual-Database Engine** ที่สามารถเชื่อมต่อดึงข้อมูลผู้ป่วยจากระบบสารสนเทศโรงพยาบาล (Hospital Information System: HIS / HOSxP) ได้แบบ Real-time และในขณะเดียวกันสามารถตัดการทำงานเข้าสู่ **Standalone Mode** ได้อย่างราบรื่น (Zero-Disruption) เพื่อให้หน่วยบริการหรือโรงพยาบาลอื่นที่ไม่ได้เชื่อมต่อ HIS สามารถนำเข้าข้อมูลผ่านไฟล์ CSV หรือบันทึกเคสตรวจประเมินด้วยตนเองได้โดยไม่มีข้อผิดพลาด พร้อมด้วยระบบความปลอดภัยระดับสถาบันการแพทย์ (Hospital-Grade Security) และการเก็บบันทึกประวัติการใช้งาน (Audit Trail) ตามมาตรฐาน PDPA และ ISO/IEC 27001 ครบถ้วนทุกมิติ

---

## 🏛️ สถาปัตยกรรมและเทคโนโลยีการพัฒนา (Architecture & Technology Stack)

### 1. สถาปัตยกรรมระบบภาพรวม (High-Level Architecture)

ระบบ e-MRA พัฒนาด้วยสถาปัตยกรรมแบบ **Modern Modular Full-Stack Web Architecture** บนแนวคิด Decoupled Logic & Edge-Ready Integration โดยแบ่งโครงสร้างออกเป็น 4 ชั้นหลัก:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client / Presentation Layer                   │
│      React 19 / Next.js 16 (App Router) + Tailwind CSS + Lucide Icons   │
│     Zustand State Stores (useUnifiedAuditStore, useIpdAuditStore, etc.)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / WebSocket (HMR)
┌────────────────────────────────────▼────────────────────────────────────┐
│                        Edge Security & Proxy Layer                      │
│     src/proxy.ts: Security Headers, Route Protection, Session Resolver  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Internal Dispatch
┌────────────────────────────────────▼────────────────────────────────────┐
│                       Application & API Services Layer                  │
│  - Dynamic Scoring & Clinical Rule Engine (MRACalculator, IPD Evaluator)│
│  - Auth & RBAC Service (PBKDF2 Hashing, Session JWT, TOTP MFA RFC 6238) │
│  - Intelligent Sampling Engine (HIS Automated / Standalone CSV Import)  │
│  - Audit Trail & Event Logger (ISO/IEC 27001 Standard)                  │
│  - Excel & PDF Generation Service (ExcelJS Engine, PDF.js Core)         │
└──────────────────┬──────────────────────────────────────┬───────────────┘
                   │ SQL (Strict Read-Only)               │ SQL (Read/Write)
┌──────────────────▼──────────────┐    ┌──────────────────▼──────────────┐
│     Hospital HIS Database       │    │     e-MRA Internal Database     │
│   (HOSxP MySQL 5.7 / 8.0)       │    │      (db_mra on Localhost)      │
│  - opduser, doctor, clinic      │    │  - users, mra_audit_trail       │
│  - ovst, vn_stat, ipt, ward     │    │  - mra_batches, mra_audit_items │
│  - icd101, patient              │    │  - mra_ipd_audit_records        │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

### 2. สถาปัตยกรรมฐานข้อมูลคู่ขนานแบบไฮบริด (Hybrid Dual-Database Architecture)

เพื่อรับประกันความปลอดภัยสูงสุดของข้อมูลผู้ป่วยในโรงพยาบาล ระบบจึงแยกสายการเชื่อมต่อฐานข้อมูลออกเป็น 2 ท่ออย่างเด็ดขาด:

1. **Hospital HIS Database Connection (Strict Read-Only):**
   - เชื่อมต่อไปยังฐานข้อมูลหลักของโรงพยาบาล (เช่น HOSxP) เพื่อดึงข้อมูลประวัติผู้รับบริการ, แพทย์, หอผู้ป่วย, คลินิก และรหัสโรค ICD-10
   - **มาตรการความปลอดภัยเด็ดขาด:** โค้ดระดับ Driver (`queryHis`) บังคับใช้ Regular Expression ดักจับคำสั่งต้องห้าม (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE` ฯลฯ) หากมีการพยายามเขียนข้อมูล ระบบจะตัดการทำงานทันที ป้องกันไม่ให้ส่งผลกระทบต่อฐานข้อมูลบริการของโรงพยาบาล 100%
2. **e-MRA Internal Database Connection (Read/Write with Transactions):**
   - จัดการฐานข้อมูลท้องถิ่น `db_mra` เพื่อบันทึกผลการตรวจประเมินเวชระเบียน, คะแนนประเมิน, ชุดการสุ่มตรวจ (Batches), บัญชีผู้ใช้งานระบบ, ประวัติ Audit Trail และการตั้งค่า 
   - รองรับ Database Connection Pooling, Prepared Statements เพื่อป้องกัน SQL Injection และรองรับระบบสำรองข้อมูล (Automated SQL Dump Backup) ในตัว

### 3. ความพร้อมใช้งานแบบออฟไลน์ (Graceful Offline / Standalone Capability)

ระบบถูกออกแบบให้รองรับการนำไปติดตั้งใช้งานในหน่วยบริการสุขภาพทุกระดับ:
- **โหมดเชื่อมต่อ HIS (Online Mode):** ดึงข้อมูลผู้รับบริการและสุ่มตรวจอัตโนมัติด้วยความเร็วระดับเสี้ยววินาที (Latency < 50ms)
- **โหมดใช้งานอิสระ (Standalone Mode):** เมื่อไม่ได้เชื่อมต่อ HIS หรือเครือข่ายขัดข้อง ระบบจะสลับเข้าสู่ Standalone Mode โดยอัตโนมัติภายในช่วงเวลา Timeout ที่กำหนด โดยไม่มีข้อผิดพลาดสีแดงหรือหน้าจอค้าง ผู้ตรวจสามารถบันทึกเคสด้วยตนเอง หรือนำเข้าข้อมูลผู้รับบริการผ่านไฟล์ CSV เพื่อเริ่มตรวจประเมินและออกรายงานได้ทันที

### 4. รายการเทคโนโลยีหลัก (Technology Stack Matrix)

| องค์ประกอบ (Component) | เทคโนโลยีที่เลือกใช้ (Technology) | เวอร์ชัน / รายละเอียด | ประโยชน์และเหตุผลเชิงเทคนิค |
| :--- | :--- | :--- | :--- |
| **Core Framework** | Next.js (App Router Architecture) | 16.3.8 (Turbopack) | รองรับ Server-Side Rendering (SSR), Static Generation และ API Routes ประสิทธิภาพสูง |
| **Frontend Library** | React | 19.0.0 | การจัดการ State และ DOM Reconciliation ที่รวดเร็ว รองรับ Concurrent Features |
| **Language** | TypeScript | 5.x (Strict Mode) | การตรวจสอบ Type Safety แบบครอบคลุม 100% ลดปัญหา Runtime Bugs |
| **State Management** | Zustand | 5.x | จัดการ Global State ขนาดเบา (Lightweight), ไม่เกิด Re-render ที่ไม่จำเป็น |
| **Styling & Design** | Tailwind CSS + Vanilla CSS Tokens | 4.x | ออกแบบ Responsive UI, Micro-animations, และรองรับ Design System ที่ยืดหยุ่น |
| **Typography** | Google Fonts (Anuphan) | 300 - 700 Weights | ตัวอักษรภาษาไทยและสากลที่อ่านง่าย ถูกต้องตามหลักสรีรศาสตร์และมาตรฐานงานเวชระเบียน |
| **Data Visualization** | Recharts | 2.x | กราฟิกสถิติคุณภาพสูง: Area Charts, Stacked Bar Charts, Pie/Donut Charts, KPI Gauges |
| **Spreadsheet Engine**| ExcelJS | 4.x | สร้างไฟล์ Microsoft Excel (.xlsx) คุณภาพสูงพร้อมจัดสไตล์ ตราสัญลักษณ์ และสูตรคำนวณ |
| **PDF Viewing Core** | PDF.js by Mozilla (Worker-based) | Custom Built-in | แสดงผลคู่มือมาตรฐาน สปสช. ในตัวแอปพลิเคชันโดยไม่ต้องพึ่งพาปลั๊กอินภายนอก |
| **Database Driver** | MySQL2 / Promise | 3.x | จัดการ Connection Pool, Prepared Statements ปลอดภัยและรวดเร็ว |
| **Cryptography** | Web Crypto API + Node Crypto | Native High-entropy | การคำนวณ PBKDF2 Hashing, HMAC-SHA256 Token, และ AES-256-GCM Encryption |

---

## 🔒 สถาปัตยกรรมความปลอดภัยของระบบ (Enterprise Security Architecture)

ระบบ e-MRA ได้รับการออกแบบตามหลักการ **Defense in Depth** และสอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) รวมถึงกรอบความมั่นคงปลอดภัยสารสนเทศทางการแพทย์:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: Edge Proxy & Transport                 │
│        - HTTPS / TLS 1.3 Transport Encryption                          │
│        - Strict Hospital-grade Security Headers (HSTS, CSP, X-Frame)   │
│        - Open Redirect & Path Traversal Guards                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    LAYER 2: Identity & Access Management               │
│        - Hybrid Authentication (HOSxP Passweb/Password + Local PBKDF2) │
│        - Stateless HMAC-SHA256 Session JWT (HttpOnly, SameSite=Lax)    │
│        - Multi-Factor Authentication (MFA / TOTP RFC 6238)             │
│        - Role-Based Access Control (RBAC: Admin / Auditor / Officer)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     LAYER 3: Data Protection & Isolation               │
│        - HIS Strict Read-Only Query Sanitizer (Regex Guard)            │
│        - Parameterized SQL Prepared Statements (Anti-SQL Injection)    │
│        - AES-256-GCM Secret Encryption for TOTP Keys                   │
│        - Automatic Local User Caching for Disaster Recovery            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     LAYER 4: Audit Trail & Traceability                │
│        - ISO/IEC 27001 Compliant Immutable Audit Logging               │
│        - Full Event Traceability (Actor, Role, Action, IP, Payload)    │
│        - Severity Classification (Info, Warning, Critical)             │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. การพิสูจน์ตัวตนแบบไฮบริด (Hybrid Authentication & Disaster Recovery)
1. **การยืนยันตัวตนผ่าน HIS เป็นอันดับแรก (Primary Auth):** ตรวจสอบรหัสผ่านกับฐานข้อมูลโรงพยาบาล รองรับทั้งฟอร์แมต `passweb` และ `password` แบบดั้งเดิม พร้อมตรวจสอบสถานะ `account_disable = 'Y'` เพื่อระงับสิทธิ์บัญชีที่ปิดใช้งานทันที
2. **การสำรองข้อมูลผู้ใช้งานเบื้องหลัง (Background Sync):** เมื่อผู้ใช้งานเข้าสู่ระบบสำเร็จ ข้อมูลโปรไฟล์และรหัสผ่านจะถูกนำมา Hash ด้วยกระบวนการ **PBKDF2-HMAC-SHA256 (10,000 Iterations พร้อม Salt 64-byte)** บันทึกลงตาราง `users` ของ `db_mra`
3. **การเข้าใช้งานยามฉุกเฉิน (Offline Fallback):** หากฐานข้อมูล HIS ปิดปรับปรุงหรือนำระบบไปใช้นอกเครือข่าย ผู้ใช้งานสามารถล็อกอินเข้าสู่ระบบท้องถิ่นได้ทันทีโดยไม่ต้องตั้งค่าใหม่

### 2. การยืนยันตัวตนแบบหลายปัจจัย (Multi-Factor Authentication: MFA)
- พัฒนาตามมาตรฐาน **RFC 6238 Time-based One-Time Password (TOTP)**
- ผู้ใช้งานสามารถเปิดใช้งาน MFA ร่วมกับแอปพลิเคชันมาตรฐาน เช่น Google Authenticator, Microsoft Authenticator หรือ Duo Security
- Secret Key ของผู้ใช้แต่ละรายจะถูกเข้ารหัสด้วยอัลกอริทึม **AES-256-GCM** ก่อนจัดเก็บลงฐานข้อมูล เพื่อป้องกันการรั่วไหลของกุญแจความปลอดภัยแม้ฐานข้อมูลจะถูกเข้าถึงโดยไม่ได้รับอนุญาต

### 3. การควบคุมสิทธิ์ตามบทบาท (Role-Based Access Control: RBAC)
ระบบแบ่งระดับสิทธิ์ของผู้ใช้งานออกเป็น 3 ระดับอย่างชัดเจนตามมาตรฐานงานโรงพยาบาล:
1. **Administrator (ผู้ดูแลระบบ):** จัดการผู้ใช้งาน, คอนฟิกการเชื่อมต่อฐานข้อมูล, สำรองฐานข้อมูล, จัดการกุญแจความปลอดภัยระบบ (Setup Key), และสามารถยกเลิก/ลบรอบการสุ่มตรวจได้
2. **Auditor (ผู้ตรวจประเมินเวชระเบียน):** แพทย์, พยาบาลวิชาชีพ, เจ้าพนักงานเวชสถิติ และเจ้าหน้าที่เวชระเบียน สามารถสุ่มตรวจเวชระเบียน, บันทึกการตรวจประเมิน, แก้ไขผลคะแนน และพิมพ์รายงานสรุปผล
3. **Officer (เจ้าหน้าที่ทั่วไป):** สามารถเข้าดูรายงาน สถิติ และผลการตรวจประเมินได้แบบอ่านอย่างเดียว (Read-Only) ไม่สามารถสร้างรอบการสุ่มหรือแก้ไขคะแนนได้

### 4. ระบบบันทึกประวัติการตรวจสอบย้อนกลับ (Audit Trail & Logging Governance)
- จัดเก็บทุกการกระทำสำคัญลงในตาราง `mra_audit_trail` (Login, Logout, สุ่มตัวอย่าง, บันทึกผลประเมิน, แก้ไขข้อมูล, ยกเลิกผลการตรวจ, ส่งออกรายงาน)
- บันทึก IP Address, User-Agent, วันเวลาที่แน่นอน, ผลลัพธ์ (Success / Failed), และข้อมูล JSON Snapshot ก่อน-หลังการเปลี่ยนแปลง
- มีหน้าจอตรวจสอบ `/audit-logs` ที่สามารถค้นหา กรองตามหมวดหมู่ ระดับความรุนแรง (Severity) และส่งออกข้อมูลเป็น CSV เพื่อการตรวจสอบตามกฎหมาย

---

## 🧩 ฟังก์ชันการทำงานและ 8 โมดูลหลัก (Core Modules & Capabilities)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              e-MRA System Modules                               │
├────────────────────┬────────────────────┬──────────────────┬────────────────────┤
│ 1. Executive       │ 2. OPD/ER Clinical │ 3. IPD Clinical  │ 4. Intelligent     │
│    Analytics       │    Audit Engine    │    Audit Engine  │    Sampling Engine │
│    (/dashboard)    │    (/, /opd-table) │    (/ipd)        │    (/sampling,     │
│                    │                    │                  │     /ipd/sampling) │
├────────────────────┼────────────────────┼──────────────────┼────────────────────┤
│ 5. Comprehensive   │ 6. Regulatory      │ 7. Built-in MRA  │ 8. Enterprise      │
│    Reporting       │    Audit Trail     │    Manual Hub    │    Settings & DB   │
│    (/reports)      │    (/audit-logs)   │    (/manual)     │    (/settings)     │
└────────────────────┴────────────────────┴──────────────────┴────────────────────┘
```

### 1. แดชบอร์ดสรุปภาพรวมสำหรับผู้บริหาร (`/dashboard`)
- **KPI Target Tracking:** แสดงผลคะแนนเฉลี่ยรวมเปรียบเทียบกับเกณฑ์มาตรฐาน สปสช. (ผ่านเกณฑ์ ≥ 80.00%) ผ่านเข็มวัด KPI Gauge แบบ Real-time
- **Service Dimension Analysis:** จำแนกคะแนนคุณภาพเวชระเบียนตาม 5 ประเภทบริการ: ผู้ป่วยนอกทั่วไป (OPD), ผู้ป่วยใน (IPD), อุบัติเหตุ-ฉุกเฉิน (ER), คลินิกโรคเรื้อรัง (NCDs), และจิตเวช (Psychiatric)
- **Trend Area Chart:** กราฟวิเคราะห์แนวโน้มคะแนนเฉลี่ยย้อนหลัง 12 เดือน เพื่อประเมินพัฒนาการคุณภาพการบันทึกขององค์กร
- **Top 5 Deficiency Infographics:** อินโฟกราฟิกสรุป 5 จุดบกพร่องที่พบบ่อยที่สุดในเวชระเบียน เพื่อให้ทีมนำทางคลินิก (PCT) นำไปปรับปรุงกระบวนการดูแลรักษาได้ตรงจุด
- **One-Click Print Executive Briefing:** ปุ่มพิมพ์รายงานสรุปผลการประเมินสำหรับผู้บริหารในรูปแบบกระดาษมาตรฐาน A4 ได้ทันที

### 2. โมดูลตรวจประเมินเวชระเบียนผู้ป่วยนอกและฉุกเฉิน (`/` และ `/opd-table`)
- **รองรับ 5 หมวดหมู่มาตรฐาน 33 ข้อเกณฑ์ สปสช.:**
  1. *Patient's Profile (3 ข้อ)* - ข้อมูลทั่วไปและระบุตัวตนผู้รับบริการ
  2. *History Taking (7 ข้อ)* - การซักประวัติ อาการสำคัญ ประวัติการแพ้ ประวัติอดีต
  3. *Physical Examination (7 ข้อ)* - การตรวจร่างกาย สัญญาณชีพ การตรวจเฉพาะระบบ
  4. *Investigation & Diagnosis (8 ข้อ)* - การตรวจทางห้องปฏิบัติการ/รังสี และการวินิจฉัยโรคตาม ICD-10
  5. *Treatment & Management (8 ข้อ)* - แผนการรักษา การให้ยา คำแนะนำ และการลงลายมือชื่อแพทย์
- **Dynamic Scoring Calculator:** คำนวณคะแนนอัตโนมัติรองรับการให้คะแนนแบบ `1` (ผ่าน), `0` (ไม่ผ่าน), `NA` (ไม่เกี่ยวข้อง - ตัดออกจากตัวหาร), และ `M` (ข้อมูลสูญหาย)
- **Clinical Exception Handlers:** ปรับเกณฑ์ให้อัตโนมัติเมื่อเป็นเคสจิตเวช (Psychiatric), เคสโรคเรื้อรัง (NCD), หรือเคสฉุกเฉิน (ER)
- **Dual Assessment Interfaces:**
  - *Interactive Criteria View:* หน้าจอแสดงคำอธิบายเกณฑ์ละเอียด พร้อมคำแนะนำการให้คะแนน เหมาะสำหรับการตรวจแบบวิเคราะห์
  - *Fast Tabular View (`/opd-table`):* หน้าจอตารางแบบกระชับ (High-Density Grid) พร้อมระบบคีย์ลัดสำหรับผู้ตรวจประเมินที่ต้องการบันทึกข้อมูลอย่างรวดเร็ว

### 3. โมดูลตรวจประเมินเวชระเบียนผู้ป่วยใน (`/ipd`)
- ครอบคลุมการตรวจเวชระเบียนผู้ป่วยในที่จำหน่ายแล้ว (Discharge Summary & Inpatient Records)
- รองรับการประเมินแยกตาม 6 กลุ่มโรคหลัก: อายุรกรรม (Medical), ศัลยกรรม (Surgical), กุมารเวชกรรม (Pediatric), สูติ-นรีเวชกรรม (Ob-Gyn), จิตเวช (Psychiatric), และโรคทั่วไป
- ระบบประเมินคะแนนเต็ม 56 คะแนน (กรณีทั่วไป) และ 57 คะแนน (กรณีจิตเวช) พร้อมระบบตรวจสอบลายมือชื่อแพทย์ผู้จำหน่ายและบันทึกการพยาบาล

### 4. โมดูลสุ่มตรวจอัจฉริยะ (`/sampling` และ `/ipd/sampling`)
- **Automated Random Sampling:** เชื่อมต่อ HIS เพื่อสุ่มดึงกลุ่มตัวอย่างตามช่วงวันที่, แผนก, หอผู้ป่วย, คลินิก และจำนวนขนาดตัวอย่าง (5, 10, 20, 30, 50 ชาร์ต) ด้วยอัลกอริทึม Fisher-Yates Shuffle
- **Offline / Standalone Import:** รองรับการนำเข้าไฟล์ CSV หรือบันทึกเคสด้วยตนเอง เพื่อสร้างชุดการสุ่มตรวจ (Audit Batch) ในกรณีที่ไม่เชื่อมต่อ HIS
- **Batch Lifecycle Management:** จัดการสถานะรอบการสุ่ม (`active`, `completed`, `cancelled`) ติดตามความคืบหน้าร้อยละการตรวจเสร็จสิ้น และป้องกันการตรวจซ้ำซ้อน
- **Batch Summary Modal:** หน้าต่างสรุปผลคะแนนของรอบการสุ่ม แสดงคะแนนรวม จุดบกพร่องหลัก และปุ่มส่งออกรายงาน Excel สรุปผลทั้งรอบ

### 5. โมดูลระบบรายงานและสถิติ (`/reports`)
- สรุปคะแนนเปรียบเทียบตามแพทย์ผู้ตรวจ, หอผู้ป่วย, แผนก, คลินิก, และช่วงเวลา
- กราฟจำแนกระดับคุณภาพเวชระเบียน: ยอดเยี่ยม (≥90%), ผ่านเกณฑ์ (80-89.99%), และต้องปรับปรุง (<80%)
- ส่งออกไฟล์ Excel (.xlsx) ที่มีโครงสร้างฟอร์แมตทางการแพทย์ พร้อมหัวรายงาน ตารางสรุป และสูตรคำนวณอัตโนมัติ

### 6. โมดูลคู่มือมาตรฐานดิจิทัลในระบบ (`/manual`)
- รวมคู่มือการตรวจสอบเวชระเบียน สปสช. ปี 2563 ฉบับเต็ม (PDF) บรรจุไว้ในระบบ
- ระบบเปิดอ่านแบบ Interactive ด้วย PDF.js: ค้นหาคำในเอกสาร, กระโดดไปยังหน้า, ขยายภาพ, และโหมดเต็มหน้าจอ (Fullscreen) ช่วยให้ผู้ตรวจเปิดทบทวนเกณฑ์ตัดสินได้ทันทีโดยไม่ต้องเปิดเอกสารภายนอก

### 7. โมดูลตรวจสอบบันทึกความปลอดภัย (`/audit-logs`)
- หน้าจอสำหรับผู้ดูแลระบบและฝ่ายสารสนเทศในการสืบค้นประวัติการใช้งาน
- สามารถกรองข้อมูลตามช่วงเวลา ผู้ใช้งาน หรือประเภทเหตุการณ์ เพื่อใช้ในการตรวจสอบข้อเท็จจริงกรณีเกิดเหตุการณ์ไม่พึงประสงค์ทางไซเบอร์

### 8. โมดูลตั้งค่าและสำรองฐานข้อมูล (`/settings`)
- หน้าจอทดสอบการเชื่อมต่อฐานข้อมูล HIS และ MRA พร้อมแสดงเวลาหน่วง (Latency ms) แบบ Real-time
- ระบบสร้างไฟล์สำรองฐานข้อมูลฉุกเฉิน (Automated SQL Dump Export) ด้วยคลิกเดียว
- หน้าจอจัดการสิทธิ์ผู้ใช้งาน และการรีเซ็ตการยืนยันตัวตน 2 ขั้นตอน (MFA Reset by Admin)

---

## 📊 ตารางเปรียบเทียบ: กระบวนการตรวจแบบดั้งเดิม vs ระบบ e-MRA

| ประเด็นการเปรียบเทียบ | การตรวจด้วยกระดาษแบบดั้งเดิม (Paper-based) | ระบบตรวจประเมิน e-MRA (Digital System) |
| :--- | :--- | :--- |
| **ระยะเวลาในการสุ่มเวชระเบียน** | 30 - 60 นาที (ต้องค้นหาและดึงแฟ้มจากห้องบัตร) | **< 3 วินาที** (ระบบสุ่มตัวอย่างจาก HIS หรือ CSV อัตโนมัติ) |
| **ความผิดพลาดในการคำนวณคะแนน** | พบบ่อย (คำนวณด้วยมือ, ลืมตัดตัวหาร NA) | **0%** (ระบบคำนวณคะแนนและตัด NA ด้วยสูตรทางคณิตศาสตร์อัตโนมัติ) |
| **การรวมผลและออกรายงาน** | ใช้เวลาหลายวัน (ต้องกรอกลง Excel อีกทอด) | **แสดงผลทันทีแบบ Real-time** พร้อมกราฟและดาวน์โหลดไฟล์ Excel ได้ทันที |
| **ความมั่นคงปลอดภัยของข้อมูล** | เสี่ยงต่อการสูญหาย เอกสารชำรุด หรือเปิดอ่านโดยพลการ | **ความปลอดภัยระดับสูง** เข้ารหัสข้อมูล มี MFA และบันทึก Audit Trail ทุกขั้นตอน |
| **การเข้าถึงคู่มือเกณฑ์การตัดสิน** | ต้องพกพาหนังสือคู่มือเล่มหนา | **มีคู่มือดิจิทัลเปิดอ่านเคียงข้างหน้าจอตรวจได้ทันที** |
| **ความยืดหยุ่นในการใช้งาน** | ต้องอยู่ที่ห้องเวชระเบียนเท่านั้น | **ทำงานได้ทั้งโหมดเชื่อมต่อ HIS และ Standalone ออฟไลน์** |

---

## 📜 ความสอดคล้องกับมาตรฐานระดับประเทศและสากล (Compliance Matrix)

| เกณฑ์มาตรฐาน (Standard / Guideline) | องค์กรผู้กำหนด (Authority) | การนำมาประยุกต์ใช้ในระบบ e-MRA (Implementation) |
| :--- | :--- | :--- |
| **คู่มือการตรวจสอบเวชระเบียน (MRA) พ.ศ. 2563** | สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) | ถอดข้อเกณฑ์ตรวจประเมินทั้ง 33 ข้อ (OPD) และข้อเกณฑ์ IPD มาสร้างเป็น Data Models, กฎการคำนวณคะแนน, และสูตรตัดคะแนน NA อย่างถูกต้อง 100% |
| **HOSxP Database Standards** | บริษัท บางกอก เมดิคอล ซอฟต์แวร์ (BMS) | รองรับโครงสร้าง Schema ตารางมาตรฐาน เช่น `opduser`, `doctor`, `ovst`, `vn_stat`, `ipt`, `ward`, `clinic` โดยไม่มีการดัดแปลงหรือเขียนทับโครงสร้างเดิม |
| **ICD-10 / ICD-9-CM Standards** | องค์การอนามัยโลก (WHO) / สปสช. | รองรับโครงสร้างการวินิจฉัยโรคหลัก (Primary Diagnosis), โรคร่วม (Comorbidity), และหัตถการ |
| **PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562)** | ประเทศไทย | ระบบควบคุมการเข้าถึงข้อมูลตามความจำเป็น (Principle of Least Privilege), การเข้ารหัสผ่านและ Token, และเก็บบันทึกประวัติการเข้าถึงข้อมูลผู้ป่วย |
| **ISO/IEC 27001 Security Controls** | มาตรฐานสากล | มีการจัดเก็บบันทึก Audit Trail ครบถ้วน, ตรวจสอบความปลอดภัย Transport Layer, ป้องกัน CSRF / XSS / SQL Injection และ Clickjacking |
| **RFC 6238 (TOTP Specification)** | IETF Standards | มาตรฐานการคำนวณรหัส OTP แบบอิงเวลา สำหรับระบบยืนยันตัวตน 2 ขั้นตอน (2FA / MFA) |

---

## 🚀 ขั้นตอนการติดตั้งและการ Deploy (Deployment Guide)

### 1. ความต้องการของระบบ (Prerequisites)
- **Node.js:** เวอร์ชัน 20 LTS หรือ 22 LTS ขึ้นไป
- **MySQL Server:** เวอร์ชัน 8.0 ขึ้นไป หรือ MariaDB 10.5 ขึ้นไป
- **เครือข่าย:** สามารถเชื่อมต่อไปยังฐานข้อมูล HOSxP ผ่าน TCP Port 3306

### 2. การเตรียมฐานข้อมูล (Database Setup)
นำเข้าโครงสร้างฐานข้อมูลเริ่มต้น (Clean Production Schema) จากโฟลเดอร์ `database/`:
```bash
mysql -u root -p db_mra < database/db_mra_20261008.sql
```

### 3. ตั้งค่าสภาพแวดล้อม (Environment Configuration)
คัดลอกไฟล์ `.env.example` เป็น `.env.local` และกำหนดค่าการเชื่อมต่อ:
```bash
cp .env.example .env.local
```
แก้ไขรายละเอียดใน `.env.local`:
```env
# Hospital HIS Database (Strict Read-Only)
HIS_DB_HOST=10.250.100.201
HIS_DB_PORT=3306
HIS_DB_DATABASE=hos
HIS_DB_USER=hxpkt
HIS_DB_PASSWORD=your_his_password

# MRA Dedicated Database (Full Read / Write)
MRA_DB_HOST=127.0.0.1
MRA_DB_PORT=3306
MRA_DB_DATABASE=db_mra
MRA_DB_USER=root
MRA_DB_PASSWORD=your_mra_password

# Emergency Setup Key for pre-login database configuration & setup
ADMIN_SETUP_KEY=mra@admin2026

# Session Secret (กำหนดข้อความสุ่มเพื่อความปลอดภัยสูงสุด)
SESSION_SECRET=mra-hospital-audit-secret-key-2026
```

### 4. ติดตั้ง Dependencies และ Build ระบบ
```bash
npm install
npm run build
```

### 5. เริ่มต้นการทำงาน (Start Production Server)
```bash
npm start
```
หรือรันผ่าน PM2 เพื่อให้ระบบทำงานเป็น Background Service พร้อมระบบ Restart อัตโนมัติ:
```bash
pm2 start npm --name "mra-system" -- start
pm2 save
pm2 startup
```

## 👨‍💻 ผู้พัฒนาและหน่วยงานรับผิดชอบ (Development & Maintainer)

ระบบ **e-MRA (Electronic Medical Record Audit)** ได้รับการออกแบบ วิจัย และพัฒนาขึ้นเพื่อการใช้งานจริงในโรงพยาบาล โดย:

* **ผู้พัฒนา (Developer):** นายวิษณุ ศรีโยธา (Witsanu Sriyotha)
* **ตำแหน่ง (Position):** นักวิชาการคอมพิวเตอร์
* **กลุ่มงาน (Department):** กลุ่มงานสุขภาพดิจิทัล (Digital Health Department)
* **หน่วยงาน (Organization):** โรงพยาบาลกมลาไสย จังหวัดกาฬสินธุ์
* **สำนักงานสาธารณสุขจังหวัด:** สำนักงานสาธารณสุขจังหวัดกาฬสินธุ์ เขตสุขภาพที่ 7 กระทรวงสาธารณสุข

---

## 📄 ลิขสิทธิ์และการใช้งาน (License & Intellectual Property)

ระบบ e-MRA ได้รับการพัฒนาขึ้นเพื่อยกระดับคุณภาพเวชระเบียนและระบบสารสนเทศสุขภาพภาครัฐ สงวนลิขสิทธิ์สำหรับการใช้งานภายในโรงพยาบาลกมลาไสย และหน่วยบริการทางการแพทย์ที่ได้รับอนุญาต

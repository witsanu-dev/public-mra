# e-MRA (Electronic Medical Record Audit)

ระบบตรวจสอบและประเมินคุณภาพเวชระเบียนผู้ป่วยนอก (OPD) ผู้ป่วยฉุกเฉิน (ER) และผู้ป่วยใน (IPD) ตามเกณฑ์มาตรฐานสำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.) ปี 2563

---

## 🌟 ฟังก์ชันหลักของระบบ (Core Features)

1. **Executive Dashboard (`/dashboard`):** แสดงเข็มวัดระดับคุณภาพเทียบกับเป้าหมาย สปสช. (≥ 80%), กราฟแนวโน้มคะแนนย้อนหลัง 12 เดือน, อินโฟกราฟิกสรุป 5 จุดบกพร่องที่พบบ่อย และพิมพ์รายงานสรุป
2. **OPD/ER Clinical Audit (`/` และ `/opd-table`):** เครื่องมือตรวจประเมิน 5 หมวด 33 ข้อย่อย พร้อมระบบตัดข้อไม่เข้าเกณฑ์ (NA) อัตโนมัติ สลับมุมมองได้ทั้งแบบ Interactive Criteria View และ Fast Tabular View
3. **IPD Clinical Audit (`/ipd`):** ระบบตรวจประเมินผู้ป่วยในจำหน่ายแล้ว 6 กลุ่มโรคหลักตามฐานคะแนน 56–57 คะแนน
4. **Intelligent Sampling System (`/sampling` และ `/ipd/sampling`):** สุ่มดึงเวชระเบียนจาก HIS/HOSxP หรือนำเข้า CSV พร้อมระบบ Batch Management ติดตามร้อยละความคืบหน้า
5. **Advanced Reporting & Excel Export (`/reports`):** รายงานสรุปคะแนนแยกตามแพทย์, แผนก, คลินิก, หอผู้ป่วย พร้อมส่งออกไฟล์ Excel (.xlsx) ที่จัดรูปแบบสวยงาม
6. **Regulatory Audit Trail (`/audit-logs`):** บันทึกประวัติการเข้าใช้งานตามมาตรฐาน พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) และ ISO/IEC 27001
7. **Built-in Digital Guidelines Hub (`/manual`):** คลังคู่มือเกณฑ์การตรวจ สปสช. 2563 ฉบับเต็มเปิดอ่านได้ในตัว
8. **Enterprise Settings & Maintenance (`/settings`):** ตรวจสอบ Latency ฐานข้อมูล, สำรอง/กู้คืนฐานข้อมูล SQL, และจัดการยืนยันตัวตนสองชั้น (TOTP 2FA)

---

## 🛡️ ความปลอดภัยและสถาปัตยกรรม (Architecture & Security)

- **Frontend & Fullstack:** Next.js 16 (App Router), React 19, TypeScript
- **Hybrid Dual-Database Engine:**
  - **Hospital HIS (Strict Read-Only):** ดึงข้อมูลผู้ป่วยจาก HOSxP MySQL ด้วยตัวกรองความปลอดภัย Query Guard ป้องกันการเขียน/แก้ไขข้อมูลในฐานหลักของโรงพยาบาล 100%
  - **Internal DB (`db_mra`):** จัดเก็บข้อมูลผลการประเมิน, บัญชีผู้ใช้, รอบการสุ่ม, และประวัติการทำงาน
- **Authentication & Security:** 
  - ล็อกอินด้วยบัญชี HOSxP และระบบซิงค์ข้อมูลสำรองด้วย PBKDF2 (10,000 Iterations)
  - รองรับ Multi-Factor Authentication (RFC 6238 TOTP) เข้ารหัสลับด้วย AES-256-GCM
  - ควบคุมสิทธิ์ 3 ระดับ (Administrator, Auditor, Officer)

---

## 🚀 ขั้นตอนการติดตั้งและการ Deploy (Deployment Guide)

### 1. ความต้องการของระบบ (Prerequisites)
- **Node.js:** เวอร์ชัน 20 LTS หรือ 22 LTS ขึ้นไป
- **MySQL Server:** เวอร์ชัน 8.0 ขึ้นไป หรือ MariaDB 10.5 ขึ้นไป
- **เครือข่าย:** สามารถเชื่อมต่อไปยังฐานข้อมูล HOSxP ผ่าน TCP Port 3306

### 2. เตรียมฐานข้อมูล (Database Setup)
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
# HIS Database
HIS_DB_HOST=10.250.100.201
HIS_DB_PORT=3306
HIS_DB_DATABASE=hos
HIS_DB_USER=hxpkt
HIS_DB_PASSWORD=your_password

# MRA Dedicated Database
MRA_DB_HOST=127.0.0.1
MRA_DB_PORT=3306
MRA_DB_DATABASE=db_mra
MRA_DB_USER=root
MRA_DB_PASSWORD=your_password

# Admin Setup Key
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
หรือรันผ่าน PM2 เพื่อให้ระบบทำงานเป็น Background Service:
```bash
pm2 start npm --name "mra-system" -- start
pm2 save
```

---

## 📄 License
ระบบนี้สงวนลิขสิทธิ์สำหรับการใช้งานภายในและหน่วยบริการทางการแพทย์ที่ได้รับอนุญาต

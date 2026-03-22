const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'maintenance.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
    initSchema();
    await seedData();
    saveDb();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','technician','manager','admin')),
      department TEXT,
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      building_id INTEGER NOT NULL,
      floor TEXT NOT NULL,
      room TEXT NOT NULL,
      FOREIGN KEY(building_id) REFERENCES buildings(id)
    );
    CREATE TABLE IF NOT EXISTS repair_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT UNIQUE NOT NULL,
      requester_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('ไฟฟ้า','ประปา','โครงสร้าง','อุปกรณ์อิเล็กทรอนิกส์','เครื่องปรับอากาศ')),
      location_id INTEGER,
      location_detail TEXT,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK(urgency IN ('ฉุกเฉิน','เร่งด่วน','ปกติ','ไม่เร่งด่วน')),
      status TEXT NOT NULL DEFAULT 'รอดำเนินการ' CHECK(status IN ('รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก')),
      image_path TEXT,
      after_image_path TEXT,
      assigned_tech_id INTEGER,
      assigned_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      repair_detail TEXT,
      sla_deadline DATETIME,
      reject_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(requester_id) REFERENCES users(id),
      FOREIGN KEY(location_id) REFERENCES locations(id),
      FOREIGN KEY(assigned_tech_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      quantity INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'ชิ้น',
      unit_price REAL DEFAULT 0,
      reorder_point INTEGER DEFAULT 5,
      expiry_date DATE,
      location_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS material_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity_used INTEGER NOT NULL,
      used_by INTEGER NOT NULL,
      note TEXT,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(request_id) REFERENCES repair_requests(id),
      FOREIGN KEY(material_id) REFERENCES materials(id),
      FOREIGN KEY(used_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('in','out','adjust')),
      quantity INTEGER NOT NULL,
      note TEXT,
      ref_request_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(material_id) REFERENCES materials(id)
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER UNIQUE NOT NULL,
      evaluator_id INTEGER NOT NULL,
      quality_score INTEGER CHECK(quality_score BETWEEN 1 AND 5),
      speed_score INTEGER CHECK(speed_score BETWEEN 1 AND 5),
      service_score INTEGER CHECK(service_score BETWEEN 1 AND 5),
      avg_score REAL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(request_id) REFERENCES repair_requests(id),
      FOREIGN KEY(evaluator_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      ref_request_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_table TEXT,
      target_id INTEGER,
      detail TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedData() {
  const pw = (p) => bcrypt.hashSync(p, 10);
  db.run(`INSERT INTO users (student_id,name,email,password,role,department,phone) VALUES
    ('ADMIN001','ผู้ดูแลระบบ','admin@school.ac.th','${pw('admin1234')}','admin','ฝ่ายเทคโนโลยี','081-000-0001'),
    ('68030282','นายศุภโชค หอมสมบัติ','supachok@school.ac.th','${pw('manager1234')}','manager','วิศวกรรมศาสตร์','081-000-0002'),
    ('68030263','นายวสุรัชต์ สมเด็จ','wasurat@school.ac.th','${pw('tech1234')}','technician','ช่างไฟฟ้า','081-000-0003'),
    ('68030265','นายวัฒนพงศ์ พรหมภิราม','wattanapong@school.ac.th','${pw('tech1234')}','technician','ช่างประปา','081-000-0004'),
    ('68030258','นางสาววรัทยา รอดเมล์','warataya@school.ac.th','${pw('user1234')}','user','บริหารธุรกิจ','081-000-0005'),
    ('68030262','นายวศิน แก้วมรกต','wasin@school.ac.th','${pw('user1234')}','user','คอมพิวเตอร์','081-000-0006'),
    ('68030271','นายวีระภัทร อ่วมเกษม','weeraphath@school.ac.th','${pw('user1234')}','user','อิเล็กทรอนิกส์','081-000-0007'),
    ('68030288','นายสรวิชญ์ สิทธิรักษ์','sorawit@school.ac.th','${pw('user1234')}','user','เทคโนโลยีสารสนเทศ','081-000-0008')
  `);
  db.run(`INSERT INTO buildings (name,description) VALUES
    ('อาคาร A','อาคารเรียนหลัก ชั้น 1-4'),
    ('อาคาร B','อาคารปฏิบัติการ ชั้น 1-3'),
    ('อาคาร C','อาคารอำนวยการ ชั้น 1-2'),
    ('อาคาร D','หอพักนักศึกษา ชั้น 1-5')
  `);
  db.run(`INSERT INTO locations (building_id,floor,room) VALUES
    (1,'ชั้น 1','ห้อง 101'),(1,'ชั้น 1','ห้อง 102'),(1,'ชั้น 2','ห้อง 201'),
    (1,'ชั้น 2','ห้อง 202'),(1,'ชั้น 3','ห้อง 301'),(2,'ชั้น 1','ห้องปฏิบัติการ 1'),
    (2,'ชั้น 1','ห้องปฏิบัติการ 2'),(2,'ชั้น 2','ห้องประชุม'),(3,'ชั้น 1','สำนักงาน'),
    (3,'ชั้น 1','ห้องน้ำ ชั้น 1'),(4,'ชั้น 1','ห้องพัก 101'),(4,'ชั้น 2','ห้องพัก 201')
  `);
  db.run(`INSERT INTO materials (code,name,category,brand,quantity,unit,unit_price,reorder_point) VALUES
    ('MAT001','หลอดไฟ LED 18W','ไฟฟ้า','Philips',45,'หลอด',120,10),
    ('MAT002','สายไฟ VCT 2x1.5','ไฟฟ้า','Thai Wire',180,'เมตร',25,30),
    ('MAT003','เบรกเกอร์ 20A','ไฟฟ้า','Siemens',18,'อัน',350,5),
    ('MAT004','เต้ารับ 3 ขา','ไฟฟ้า','Panasonic',60,'อัน',85,15),
    ('MAT005','ก๊อกน้ำมิกเซอร์','ประปา','American Standard',12,'อัน',580,3),
    ('MAT006','ท่อ PVC 1/2"','ประปา','SCG',90,'เมตร',35,20),
    ('MAT007','ข้อต่อ PVC 1/2"','ประปา','SCG',150,'อัน',8,30),
    ('MAT008','ปูนซ่อมรอยร้าว','โครงสร้าง','TPI Polene',25,'ถุง',180,5),
    ('MAT009','สีทาผนัง (ขาว)','โครงสร้าง','TOA',15,'ถัง',420,3),
    ('MAT010','น้ำยาล้างแอร์','แอร์',NULL,20,'กระป๋อง',95,5),
    ('MAT011','ฟิลเตอร์แอร์','แอร์','Carrier',30,'แผ่น',150,8),
    ('MAT012','สายแพ HDMI 5m','อิเล็กทรอนิกส์','Ugreen',8,'เส้น',280,2),
    ('MAT013','เทปพันสายไฟ','ทั่วไป','3M',80,'ม้วน',25,20),
    ('MAT014','กาวซิลิโคน','ทั่วไป','Selleys',35,'หลอด',55,10),
    ('MAT015','สกรู+ถั่ว M6','ทั่วไป',NULL,4,'หลอด',2,0)
  `);

  // Sample requests
  const now = new Date();
  const d = (days) => new Date(now - days * 86400000).toISOString();
  db.run(`INSERT INTO repair_requests (tracking_id,requester_id,category,location_id,description,urgency,status,assigned_tech_id,assigned_at,started_at,completed_at,repair_detail,created_at) VALUES
    ('TRK-2568-001',5,'ไฟฟ้า',1,'หลอดไฟในห้อง 101 ดับหมดทั้งห้อง ไม่สามารถเรียนได้','เร่งด่วน','เสร็จสมบูรณ์',3,'${d(6)}','${d(5)}','${d(4)}','เปลี่ยนหลอดไฟ LED ใหม่ 4 ดวง และตรวจเช็คสวิตช์','${d(7)}'),
    ('TRK-2568-002',6,'เครื่องปรับอากาศ',7,'แอร์ห้องปฏิบัติการ 2 ไม่เย็น มีเสียงดังผิดปกติ','ปกติ','กำลังดำเนินการ',4,'${d(2)}','${d(1)}',NULL,NULL,'${d(3)}'),
    ('TRK-2568-003',7,'ประปา',10,'ก๊อกน้ำห้องน้ำชั้น 1 รั่ว น้ำไหลตลอดเวลา','เร่งด่วน','รอดำเนินการ',NULL,NULL,NULL,NULL,NULL,'${d(1)}'),
    ('TRK-2568-004',8,'อุปกรณ์อิเล็กทรอนิกส์',8,'โปรเจคเตอร์ห้องประชุมเปิดไม่ติด มีไฟ Power กะพริบ','ปกติ','รอตรวจสอบ',3,'${d(4)}','${d(3)}',NULL,'ตรวจสอบแล้ว อาจต้องเปลี่ยนหลอด โปรเจคเตอร์ อยู่ระหว่างรอยืนยันงบประมาณ','${d(5)}'),
    ('TRK-2568-005',5,'โครงสร้าง',9,'ประตูสำนักงานบานพับหัก ปิดไม่ได้','ไม่เร่งด่วน','เสร็จสมบูรณ์',3,'${d(12)}','${d(11)}','${d(10)}','เปลี่ยนบานพับใหม่ 2 ตัว พร้อมปรับระดับประตู','${d(14)}'),
    ('TRK-2568-006',6,'ไฟฟ้า',3,'ปลั๊กไฟห้อง 201 มีประกายไฟ ใช้งานไม่ได้','ฉุกเฉิน','เสร็จสมบูรณ์',3,'${d(10)}','${d(10)}','${d(9)}','เปลี่ยนเต้ารับใหม่ พร้อมตรวจสอบสายไฟ','${d(10)}')
  `);

  db.run(`INSERT INTO material_usage (request_id,material_id,quantity_used,used_by,note) VALUES
    (1,1,4,3,'เปลี่ยนหลอด 4 ดวง'),(1,13,1,3,'ใช้พันสายไฟ'),
    (5,14,1,3,'ยึดบานพับ'),(6,4,2,3,'เปลี่ยนเต้ารับ 2 จุด'),(6,13,1,3,'พันสายไฟ')
  `);
  db.run(`INSERT INTO evaluations (request_id,evaluator_id,quality_score,speed_score,service_score,avg_score,comment) VALUES
    (1,5,5,4,5,4.67,'ช่างซ่อมรวดเร็วมากครับ ผลงานเรียบร้อยดี'),
    (5,5,4,4,5,4.33,'พอใจมากครับ'),
    (6,6,5,5,5,5.0,'ดีเยี่ยม รวดเร็วมาก ปลอดภัย')
  `);
  db.run(`INSERT INTO notifications (user_id,title,message,type,ref_request_id) VALUES
    (5,'งานซ่อมเสร็จแล้ว','งาน TRK-2568-001 เสร็จสมบูรณ์แล้ว','success',1),
    (3,'งานใหม่ถูกมอบหมาย','คุณได้รับมอบหมายงาน TRK-2568-002','info',2),
    (4,'งานใหม่ถูกมอบหมาย','คุณได้รับมอบหมายงาน TRK-2568-002','info',2)
  `);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  const res = db.exec('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: Number(res[0]?.values[0][0] || 0) };
}

module.exports = { getDb, query, run, saveDb };
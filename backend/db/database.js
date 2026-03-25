const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Optional: Keep a reference to useful firestore functions
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

async function seedData() {
  // Check if users exist, to avoid seeding twice
  const usersSnapshot = await db.collection('users').limit(1).get();
  if (!usersSnapshot.empty) return;

  const bcrypt = require('bcryptjs');
  const pw = (p) => bcrypt.hashSync(p, 10);

  const users = [
    { id: '1', student_id:'ADMIN001', name:'ผู้ดูแลระบบ', email:'admin@school.ac.th', password:pw('admin1234'), role:'admin', department:'ฝ่ายเทคโนโลยี', phone:'081-000-0001', is_active:1 },
    { id: '2', student_id:'68030282', name:'นายศุภโชค หอมสมบัติ', email:'supachok@school.ac.th', password:pw('manager1234'), role:'manager', department:'วิศวกรรมศาสตร์', phone:'081-000-0002', is_active:1 },
    { id: '3', student_id:'68030263', name:'นายวสุรัชต์ สมเด็จ', email:'wasurat@school.ac.th', password:pw('tech1234'), role:'technician', department:'ช่างไฟฟ้า', phone:'081-000-0003', is_active:1 },
    { id: '4', student_id:'68030265', name:'นายวัฒนพงศ์ พรหมภิราม', email:'wattanapong@school.ac.th', password:pw('tech1234'), role:'technician', department:'ช่างประปา', phone:'081-000-0004', is_active:1 },
    { id: '5', student_id:'68030258', name:'นางสาววรัทยา รอดเมล์', email:'warataya@school.ac.th', password:pw('user1234'), role:'user', department:'บริหารธุรกิจ', phone:'081-000-0005', is_active:1 },
    { id: '6', student_id:'68030262', name:'นายวศิน แก้วมรกต', email:'wasin@school.ac.th', password:pw('user1234'), role:'user', department:'คอมพิวเตอร์', phone:'081-000-0006', is_active:1 }
  ];

  const batch = db.batch();
  users.forEach(u => {
    const docRef = db.collection('users').doc(u.id);
    batch.set(docRef, { ...u, created_at: Timestamp.now() });
  });

  const materials = [
    { code:'MAT001', name:'หลอดไฟ LED 18W', category:'ไฟฟ้า', brand:'Philips', quantity:45, unit:'หลอด', unit_price:120, reorder_point:10 },
    { code:'MAT002', name:'สายไฟ VCT 2x1.5', category:'ไฟฟ้า', brand:'Thai Wire', quantity:180, unit:'เมตร', unit_price:25, reorder_point:30 }
  ];

  materials.forEach((m, i) => {
    const docRef = db.collection('materials').doc(String(i + 1));
    batch.set(docRef, { ...m, id: String(i + 1), created_at: Timestamp.now() });
  });

  await batch.commit();
  console.log('✅ Firestore seeding completed.');
}

module.exports = { db, admin, FieldValue, Timestamp, seedData };
const express = require('express');
const { bucket } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const Busboy = require('busboy');

const router = express.Router();

router.post('/upload', authenticate, (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 } });
    
    let fileFound = false;
    let fileName = '';
    let contentType = '';
    let originalName = '';
    let writeStream = null;
    let uploadPromise = null;

    busboy.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      fileFound = true;
      originalName = filename;
      contentType = mimeType;
      fileName = `repairs/${uuidv4()}_${filename}`;
      
      const gcsFile = bucket.file(fileName);
      writeStream = gcsFile.createWriteStream({
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000'
        }
      });

      uploadPromise = new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      file.pipe(writeStream);
    });

    busboy.on('finish', async () => {
      if (!fileFound) {
        return res.status(400).json({ error: 'กรุณาแนบไฟล์รูปภาพ' });
      }

      try {
        await uploadPromise;
        const gcsFile = bucket.file(fileName);
        await gcsFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        
        res.json({ 
          message: 'อัปโหลดสำเร็จ',
          url: publicUrl,
          name: originalName
        });
      } catch (e) {
        console.error('[STORAGE ERROR]', e);
        res.status(500).json({ error: 'อัปโหลดไฟล์ล้มเหลว: ' + e.message });
      }
    });

    busboy.on('error', (err) => {
      console.error('[BUSBOY ERROR]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'การอัปโหลดขัดข้อง: ' + err.message });
      }
    });

    // In Firebase Functions, multipart data might be in rawBody
    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  } catch (err) {
    console.error('[UPLOAD ROUTE ERROR]', err);
    res.status(500).json({ error: 'ระบบอัปโหลดขัดข้อง: ' + err.message });
  }
});

module.exports = router;

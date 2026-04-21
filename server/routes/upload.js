import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { getDB } from '../db/mongodb.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST /api/upload  –  Upload an image to MongoDB
router.post('/upload', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const db = getDB();
    const result = await db.collection('images').insertOne({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      data: req.file.buffer,
      size: req.file.size,
      uploadedAt: new Date(),
      uploadedBy: req.user.uid,
    });

    const imageUrl = `/api/images/${result.insertedId}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

// GET /api/images/:id  –  Serve an image from MongoDB (public, no auth)
router.get('/images/:id', async (req, res) => {
  try {
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ message: 'Invalid image ID' });
    }

    const db = getDB();
    const image = await db.collection('images').findOne({ _id: objectId });
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.data.buffer);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ message: 'Failed to get image' });
  }
});

export default router;

import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';
import { getFileUrl } from '../utils/upload.js';

const router = express.Router();

// Get resources for an assignment
router.get('/assignment/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const resources = await prisma.assignmentResource.findMany({
      where: { assignmentId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ resources });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Create resource (file upload or link)
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), upload.single('file'), async (req, res) => {
  try {
    const { assignmentId, type, name, url } = req.body;
    const createdBy = req.user.id;

    if (type === 'FILE' && !req.file) {
      return res.status(400).json({ error: 'File is required for FILE type' });
    }

    if (type === 'LINK' && !url) {
      return res.status(400).json({ error: 'URL is required for LINK type' });
    }

    const resource = await prisma.assignmentResource.create({
      data: {
        assignmentId,
        type,
        name,
        url: type === 'FILE' ? getFileUrl(req.file.filename) : url,
        createdBy,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({ resource });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ error: 'Failed to create resource' });
  }
});

// Delete resource
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const resource = await prisma.assignmentResource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Only creator or ADMIN can delete
    if (resource.createdBy !== userId && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this resource' });
    }

    await prisma.assignmentResource.delete({
      where: { id },
    });

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

export default router;

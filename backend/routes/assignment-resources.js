import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

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

// Create resource (links only - text-only assignments)
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { assignmentId, name, url } = req.body;
    const createdBy = req.user.id;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const resource = await prisma.assignmentResource.create({
      data: {
        assignmentId,
        type: 'LINK',
        name,
        url,
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

    console.log('Resource created successfully:', resource.id);
    res.status(201).json({ resource });
  } catch (error) {
    console.error('Create resource error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create resource'
    });
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

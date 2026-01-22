import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';
import { getFileUrl, getFilePath } from '../utils/upload.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Download resource file (must be before /:id route to avoid conflicts)
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const resource = await prisma.assignmentResource.findUnique({
      where: { id },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Only allow download for FILE type
    if (resource.type !== 'FILE') {
      return res.status(400).json({ error: 'This resource is not a file' });
    }

    // Extract filename from URL (e.g., /api/v1/uploads/filename.ext)
    const urlParts = resource.url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const filePath = getFilePath(filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set CORS headers for file download
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const requestOrigin = req.headers.origin;
    const allowedOrigin = requestOrigin && (requestOrigin === frontendUrl || requestOrigin.includes(frontendUrl)) 
      ? requestOrigin 
      : frontendUrl;
    
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.name)}${path.extname(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download resource error:', error);
    res.status(500).json({ error: 'Failed to download resource' });
  }
});

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

    console.log('Create resource request:', { 
      assignmentId, 
      type, 
      name, 
      hasFile: !!req.file,
      fileSize: req.file?.size,
      fileName: req.file?.originalname 
    });

    if (type === 'FILE' && !req.file) {
      console.error('File upload failed: No file provided');
      return res.status(400).json({ error: 'File is required for FILE type' });
    }

    if (type === 'LINK' && !url) {
      return res.status(400).json({ error: 'URL is required for LINK type' });
    }

    // Verify file was saved successfully
    if (type === 'FILE' && req.file) {
      const filePath = getFilePath(req.file.filename);
      if (!fs.existsSync(filePath)) {
        console.error('File upload failed: File not saved to disk', filePath);
        return res.status(500).json({ error: 'File upload failed: file not saved' });
      }
      console.log('File saved successfully:', filePath);
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

    console.log('Resource created successfully:', resource.id);
    res.status(201).json({ resource });
  } catch (error) {
    console.error('Create resource error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({ error: 'Failed to create resource', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
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

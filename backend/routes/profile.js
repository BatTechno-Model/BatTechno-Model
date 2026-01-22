import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { upsertSuggestions } from '../utils/suggestions.js';
import { getProfileOptions } from '../utils/defaultOptions.js';
import { uploadAvatar, getFileUrl, getFilePath } from '../utils/upload.js';
import fs from 'fs';

const router = express.Router();

// Get profile options (for enums like heardFrom, educationLevel, etc.)
router.get('/options', async (req, res) => {
  try {
    const options = getProfileOptions();
    res.json({ data: options });
  } catch (error) {
    console.error('Get profile options error:', error);
    res.status(500).json({ error: 'Failed to fetch profile options' });
  }
});

// Get current user's profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    let profile = await prisma.profile.findUnique({
      where: { userId },
    });

    // Create default profile if doesn't exist
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          userId,
          isStudent: false,
          country: 'Jordan',
          city: 'Amman',
          skills: [],
          interests: [],
        },
      });
    }

    res.json({ data: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check if it's a missing table error
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('model Profile')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Profile table does not exist. Please run: cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
        command: 'cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
    });
  }
});

// Update current user's profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      isStudent,
      fullName4,
      country,
      city,
      nationality,
      phone,
      bio,
      skills,
      interests,
      experienceLevel,
      currentStatus,
      portfolioLinks,
      heardFrom,
      heardFromDetails,
      emergencyContactName,
      emergencyContactPhone,
      university,
      major,
      educationLevel,
      graduationYear,
    } = req.body;

    // Validate fullName4 if provided (must have >= 4 words)
    if (fullName4) {
      const words = fullName4.trim().split(/\s+/);
      if (words.length < 4) {
        return res.status(400).json({ error: 'Full name must contain at least 4 words' });
      }
    }

    // Validate portfolioLinks URLs if provided
    if (portfolioLinks) {
      const { githubUrl, linkedinUrl, websiteUrl } = portfolioLinks;
      const urlPattern = /^https?:\/\/.+/;
      if (githubUrl && !urlPattern.test(githubUrl)) {
        return res.status(400).json({ error: 'Invalid GitHub URL' });
      }
      if (linkedinUrl && !urlPattern.test(linkedinUrl)) {
        return res.status(400).json({ error: 'Invalid LinkedIn URL' });
      }
      if (websiteUrl && !urlPattern.test(websiteUrl)) {
        return res.status(400).json({ error: 'Invalid website URL' });
      }
    }

    // Validate required fields if isStudent=true
    if (isStudent === true) {
      if (!university) {
        return res.status(400).json({ error: 'University is required for students' });
      }
      if (!major) {
        return res.status(400).json({ error: 'Major is required for students' });
      }
    }

    // Prepare update data
    const updateData = {
      isStudent: isStudent ?? false,
      fullName4,
      country: country ?? 'Jordan',
      city: city ?? 'Amman',
      nationality,
      phone,
      bio,
      skills: Array.isArray(skills) ? skills : [],
      interests: Array.isArray(interests) ? interests : [],
      experienceLevel,
      currentStatus,
      portfolioLinks: portfolioLinks || null,
      heardFrom,
      heardFromDetails,
      emergencyContactName,
      emergencyContactPhone,
      // avatar is updated separately via /avatar endpoint
    };

    // Only include student fields if isStudent=true
    if (isStudent === true) {
      updateData.university = university;
      updateData.major = major;
      updateData.educationLevel = educationLevel;
      updateData.graduationYear = graduationYear;
    } else {
      // Clear student fields if not a student
      updateData.university = null;
      updateData.major = null;
      updateData.educationLevel = null;
      updateData.graduationYear = null;
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    // Upsert suggestions
    await upsertSuggestions({
      country: profile.country,
      city: profile.city,
      university: profile.university,
      major: profile.major,
      heardFrom: profile.heardFrom,
      skills: profile.skills,
      interests: profile.interests,
    }, profile.country);

    res.json({ data: profile });
  } catch (error) {
    console.error('Update profile error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check if it's a missing table error
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('model Profile')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Profile table does not exist. Please run: cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
        command: 'cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
    });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, async (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      console.error('Multer error details:', {
        code: err.code,
        message: err.message,
        field: err.field,
        name: err.name,
      });
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
      }
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  let uploadedFile = null;
  try {
    const userId = req.user.id;
    console.log('Avatar upload request from user:', userId);
    console.log('Request headers:', {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    });

    if (!req.file) {
      console.error('No file in request. Request body:', req.body);
      console.error('Request files:', req.files);
      return res.status(400).json({ error: 'No file uploaded. Please ensure the form field is named "avatar" and Content-Type is multipart/form-data' });
    }

    uploadedFile = req.file;
    console.log('File uploaded successfully:', {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    });

    // Validate file type (images only) - already validated by multer fileFilter, but double-check
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      // Delete uploaded file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkError) {
        console.error('Error deleting invalid file:', unlinkError);
      }
      return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkError) {
        console.error('Error deleting oversized file:', unlinkError);
      }
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
    }

    // Get current profile
    console.log('Fetching profile for user:', userId);
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    console.log('Profile found:', !!profile);

    // Delete old avatar if exists
    if (profile?.avatar) {
      try {
        // Extract filename from URL (e.g., /api/v1/uploads/filename.jpg -> filename.jpg)
        const oldFilename = profile.avatar.split('/').pop();
        if (oldFilename) {
          const oldAvatarPath = getFilePath(oldFilename);
          if (fs.existsSync(oldAvatarPath)) {
            fs.unlinkSync(oldAvatarPath);
            console.log('Deleted old avatar:', oldFilename);
          }
        }
      } catch (deleteError) {
        console.error('Error deleting old avatar:', deleteError);
        // Continue even if old avatar deletion fails
      }
    }

    // Update profile with new avatar URL
    const avatarUrl = getFileUrl(req.file.filename);
    console.log('Avatar URL:', avatarUrl);
    
    // First, try to update existing profile
    let updatedProfile;
    if (profile) {
      // Profile exists, update it
      console.log('Updating existing profile...');
      updatedProfile = await prisma.profile.update({
        where: { userId },
        data: { avatar: avatarUrl },
      });
      console.log('Profile updated successfully');
    } else {
      // Profile doesn't exist, create it
      console.log('Creating new profile...');
      updatedProfile = await prisma.profile.create({
        data: {
          userId,
          avatar: avatarUrl,
          isStudent: false,
          country: 'Jordan',
          city: 'Amman',
          skills: [],
          interests: [],
        },
      });
      console.log('Profile created successfully');
    }

    res.json({ data: updatedProfile });
  } catch (error) {
    console.error('Upload avatar error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    
    // Try to delete uploaded file if error occurred
    if (uploadedFile?.path) {
      try {
        if (fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
          console.log('Cleaned up uploaded file after error');
        }
      } catch (unlinkError) {
        console.error('Error cleaning up file after error:', unlinkError);
      }
    }
    
    // Check for specific Prisma errors
    const errorMessage = error.message || '';
    const isMissingColumn = error.code === 'P2021' || 
                           errorMessage.includes('does not exist') || 
                           errorMessage.includes('model Profile') || 
                           errorMessage.includes('column "avatar"') ||
                           errorMessage.includes('Unknown column');
    
    if (isMissingColumn) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Profile table or avatar column does not exist. Please run: cd backend && npx prisma db push',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        code: error.code,
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload avatar',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
      } : undefined,
      code: error.code,
    });
  }
});

export default router;

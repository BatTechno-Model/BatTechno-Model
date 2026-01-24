import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { upsertSuggestions } from '../utils/suggestions.js';
import { getProfileOptions } from '../utils/defaultOptions.js';

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

// Avatar upload removed - text-only assignments only

export default router;

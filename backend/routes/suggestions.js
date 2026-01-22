import express from 'express';
import prisma from '../config/database.js';
import { getDefaultSuggestions } from '../utils/defaultOptions.js';

const router = express.Router();

// Get suggestions
router.get('/', async (req, res) => {
  try {
    const { key, q, country } = req.query;

    if (!key) {
      return res.status(400).json({ error: 'Key parameter is required' });
    }

    const query = q ? q.trim().toLowerCase() : '';
    const countryScope = country || null;

    // IMPORTANT: Return empty array if query is empty (no suggestions on focus)
    if (!query || query.length === 0) {
      return res.json({ data: [] });
    }

    // Build where clause
    const where = {
      key,
    };

    // For city and university, filter by countryScope
    if (key === 'city' || key === 'university') {
      if (countryScope) {
        where.countryScope = countryScope;
      }
    } else {
      // For other keys, countryScope should be null
      where.countryScope = null;
    }

    // Get DB suggestions
    let dbSuggestions = await prisma.suggestionValue.findMany({
      where,
      orderBy: [
        { lastUsedAt: 'desc' },
        { count: 'desc' },
      ],
      take: 50, // Get more to filter by prefix match
    });

    // Filter by prefix match
    dbSuggestions = dbSuggestions.filter((s) =>
      s.value.toLowerCase().startsWith(query)
    );

    // Get default suggestions
    const defaultSuggestions = getDefaultSuggestions(key, countryScope);
    
    // Filter defaults by query
    const filteredDefaults = defaultSuggestions.filter((s) =>
      s.value.toLowerCase().startsWith(query)
    );

    // Merge DB and defaults, de-duplicate by value
    const suggestionMap = new Map();

    // Add defaults first (lower priority)
    filteredDefaults.forEach((s) => {
      if (!suggestionMap.has(s.value.toLowerCase())) {
        suggestionMap.set(s.value.toLowerCase(), {
          value: s.value,
          count: s.count || 1,
          isDefault: true,
        });
      }
    });

    // Add DB suggestions (higher priority, overwrite defaults)
    dbSuggestions.forEach((s) => {
      suggestionMap.set(s.value.toLowerCase(), {
        value: s.value,
        count: s.count,
        isDefault: false,
      });
    });

    // Convert to array and sort
    let suggestions = Array.from(suggestionMap.values());

    // Sort: prefix matches first, then DB values before defaults, then by count desc, then by lastUsedAt desc
    suggestions.sort((a, b) => {
      const aLower = a.value.toLowerCase();
      const bLower = b.value.toLowerCase();
      const aPrefix = aLower.startsWith(query);
      const bPrefix = bLower.startsWith(query);

      if (aPrefix && !bPrefix) return -1;
      if (!aPrefix && bPrefix) return 1;
      
      // Prefer DB values over defaults
      if (a.isDefault && !b.isDefault) return 1;
      if (!a.isDefault && b.isDefault) return -1;
      
      // Then by count
      if (b.count !== a.count) return b.count - a.count;
      
      return 0;
    });

    // Return top 10
    const topSuggestions = suggestions.slice(0, 10).map((s) => ({
      value: s.value,
      count: s.count,
    }));

    res.json({ data: topSuggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check if it's a missing table error
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('model SuggestionValue')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'SuggestionValue table does not exist. Please run: cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
        command: 'cd backend && npx prisma migrate dev --name add_profile_suggestions_metrics',
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch suggestions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
    });
  }
});

export default router;

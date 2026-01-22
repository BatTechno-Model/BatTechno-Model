import prisma from '../config/database.js';

/**
 * Upsert suggestions for profile fields
 */
export async function upsertSuggestions(data, countryScope = null) {
  const { country, city, university, major, heardFrom, skills, interests } = data;

  const suggestions = [];

  // Country (no countryScope)
  if (country) {
    suggestions.push({
      key: 'country',
      value: country,
      countryScope: null,
    });
  }

  // City (with countryScope)
  if (city && countryScope) {
    suggestions.push({
      key: 'city',
      value: city,
      countryScope,
    });
  }

  // University (with countryScope)
  if (university && countryScope) {
    suggestions.push({
      key: 'university',
      value: university,
      countryScope,
    });
  }

  // Major (no countryScope)
  if (major) {
    suggestions.push({
      key: 'major',
      value: major,
      countryScope: null,
    });
  }

  // HeardFrom (no countryScope)
  if (heardFrom) {
    suggestions.push({
      key: 'heardFrom',
      value: heardFrom,
      countryScope: null,
    });
  }

  // Skills (no countryScope, each skill separately)
  if (Array.isArray(skills)) {
    skills.forEach((skill) => {
      if (skill && typeof skill === 'string') {
        suggestions.push({
          key: 'skills',
          value: skill.trim(),
          countryScope: null,
        });
      }
    });
  }

  // Interests (no countryScope, each interest separately)
  if (Array.isArray(interests)) {
    interests.forEach((interest) => {
      if (interest && typeof interest === 'string') {
        suggestions.push({
          key: 'interests',
          value: interest.trim(),
          countryScope: null,
        });
      }
    });
  }

  // Upsert each suggestion
  for (const suggestion of suggestions) {
    try {
      // Find existing suggestion
      const existing = await prisma.suggestionValue.findFirst({
        where: {
          key: suggestion.key,
          value: suggestion.value,
          countryScope: suggestion.countryScope,
        },
      });

      if (existing) {
        // Update existing
        await prisma.suggestionValue.update({
          where: { id: existing.id },
          data: {
            count: { increment: 1 },
            lastUsedAt: new Date(),
          },
        });
      } else {
        // Create new
        await prisma.suggestionValue.create({
          data: {
            key: suggestion.key,
            value: suggestion.value,
            countryScope: suggestion.countryScope,
            count: 1,
            lastUsedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error upserting suggestion ${suggestion.key}:${suggestion.value}:`, error);
      console.error('Error details:', error.message);
      // Continue with other suggestions even if one fails
    }
  }
}

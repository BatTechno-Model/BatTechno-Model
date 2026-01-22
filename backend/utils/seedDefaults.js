import prisma from '../config/database.js';
import { getDefaultSuggestions, getProfileOptions } from './defaultOptions.js';

/**
 * Seed default suggestion values into the database
 * This ensures suggestions are never empty even on a fresh database
 */
export async function seedDefaultSuggestions() {
  try {
    console.log('Seeding default suggestions...');

    const defaults = [
      // Countries
      ...getDefaultSuggestions('country').map((s) => ({
        key: 'country',
        value: s.value,
        countryScope: null,
        count: 1,
      })),
      
      // Cities by country
      ...Object.entries(getProfileOptions().citiesByCountry).flatMap(([country, cities]) =>
        cities.map((city) => ({
          key: 'city',
          value: city,
          countryScope: country,
          count: 1,
        }))
      ),
      
      // Heard From
      ...getDefaultSuggestions('heardFrom').map((s) => ({
        key: 'heardFrom',
        value: s.value,
        countryScope: null,
        count: 1,
      })),
      
      // Skills
      ...getDefaultSuggestions('skills').map((s) => ({
        key: 'skills',
        value: s.value,
        countryScope: null,
        count: 1,
      })),
      
      // Interests
      ...getDefaultSuggestions('interests').map((s) => ({
        key: 'interests',
        value: s.value,
        countryScope: null,
        count: 1,
      })),
    ];

    let created = 0;
    let skipped = 0;

    for (const defaultSuggestion of defaults) {
      try {
        // Check if exists
        const existing = await prisma.suggestionValue.findFirst({
          where: {
            key: defaultSuggestion.key,
            value: defaultSuggestion.value,
            countryScope: defaultSuggestion.countryScope,
          },
        });

        if (!existing) {
          await prisma.suggestionValue.create({
            data: defaultSuggestion,
          });
          created++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`Error seeding ${defaultSuggestion.key}:${defaultSuggestion.value}:`, error.message);
      }
    }

    console.log(`Default suggestions seeded: ${created} created, ${skipped} already existed`);
    return { created, skipped };
  } catch (error) {
    console.error('Error seeding default suggestions:', error);
    throw error;
  }
}

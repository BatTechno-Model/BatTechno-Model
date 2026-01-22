/**
 * Default suggestion values that should always be available
 * These are merged with database values to ensure suggestions are never empty
 */

export const DEFAULT_COUNTRIES = [
  'Jordan',
  'Saudi Arabia',
  'UAE',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'Palestine',
  'Egypt',
];

export const DEFAULT_CITIES_BY_COUNTRY = {
  Jordan: [
    'Amman',
    'Irbid',
    'Zarqa',
    'Aqaba',
    'Salt',
    'Madaba',
    'Jerash',
    'Mafraq',
    'Karak',
    'Tafilah',
  ],
  'Saudi Arabia': [
    'Riyadh',
    'Jeddah',
    'Mecca',
    'Medina',
    'Dammam',
    'Khobar',
    'Taif',
    'Abha',
  ],
  UAE: [
    'Dubai',
    'Abu Dhabi',
    'Sharjah',
    'Ajman',
    'Ras Al Khaimah',
    'Fujairah',
    'Umm Al Quwain',
  ],
  Qatar: [
    'Doha',
    'Al Rayyan',
    'Al Wakrah',
    'Al Khor',
    'Dukhan',
  ],
  Kuwait: [
    'Kuwait City',
    'Al Ahmadi',
    'Hawalli',
    'Farwaniya',
    'Jahra',
  ],
  Bahrain: [
    'Manama',
    'Riffa',
    'Muharraq',
    'Hamad Town',
    'Isa Town',
  ],
  Oman: [
    'Muscat',
    'Salalah',
    'Sohar',
    'Nizwa',
    'Sur',
  ],
  Palestine: [
    'Ramallah',
    'Jerusalem',
    'Bethlehem',
    'Nablus',
    'Hebron',
    'Gaza',
  ],
  Egypt: [
    'Cairo',
    'Alexandria',
    'Giza',
    'Shubra El Kheima',
    'Port Said',
  ],
};

export const DEFAULT_HEARD_FROM = [
  'Facebook',
  'Instagram',
  'TikTok',
  'Google',
  'LinkedIn',
  'Friend',
  'WhatsApp',
  'Company website',
  'Other',
];

export const DEFAULT_SKILLS = [
  'HTML',
  'CSS',
  'JavaScript',
  'React',
  'Node.js',
  'Express',
  'SQL',
  'Git',
  'GitHub',
  'REST APIs',
];

export const DEFAULT_INTERESTS = [
  'Frontend',
  'Backend',
  'Full-Stack',
  'AI',
  'Mobile',
  'UI/UX',
  'DevOps',
  'Databases',
];

export const DEFAULT_EDUCATION_LEVELS = [
  'High School',
  'Diploma',
  'Bachelor',
  'Master',
  'PhD',
];

export const DEFAULT_CURRENT_STATUS = [
  'Student',
  'Employed',
  'Freelance',
  'Looking for job',
];

/**
 * Get default suggestions for a given key and country
 */
export function getDefaultSuggestions(key, country = null) {
  switch (key) {
    case 'country':
      return DEFAULT_COUNTRIES.map((value) => ({ value, count: 1, isDefault: true }));
    
    case 'city':
      if (country && DEFAULT_CITIES_BY_COUNTRY[country]) {
        return DEFAULT_CITIES_BY_COUNTRY[country].map((value) => ({ value, count: 1, isDefault: true }));
      }
      return [];
    
    case 'university':
      // Universities are country-specific but we don't have defaults
      // Return empty, rely on DB values
      return [];
    
    case 'major':
      // Majors are too diverse, rely on DB values
      return [];
    
    case 'heardFrom':
      return DEFAULT_HEARD_FROM.map((value) => ({ value, count: 1, isDefault: true }));
    
    case 'skills':
      return DEFAULT_SKILLS.map((value) => ({ value, count: 1, isDefault: true }));
    
    case 'interests':
      return DEFAULT_INTERESTS.map((value) => ({ value, count: 1, isDefault: true }));
    
    default:
      return [];
  }
}

/**
 * Get all default options for profile enums
 */
export function getProfileOptions() {
  return {
    countries: DEFAULT_COUNTRIES,
    heardFrom: DEFAULT_HEARD_FROM,
    educationLevels: DEFAULT_EDUCATION_LEVELS,
    currentStatus: DEFAULT_CURRENT_STATUS,
    skills: DEFAULT_SKILLS,
    interests: DEFAULT_INTERESTS,
    citiesByCountry: DEFAULT_CITIES_BY_COUNTRY,
  };
}

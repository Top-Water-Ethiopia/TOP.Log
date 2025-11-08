/**
 * Version Configuration
 * Central configuration for application versioning
 */

export const VERSION_CONFIG = {
  // Current application version
  current: '1.1.0',
  
  // Version history with release dates
  versions: [
    {
      version: '1.0.0',
      releaseDate: '2024-11-05',
      codename: 'Genesis',
      description: 'Initial release with core logging functionality',
      breaking: false,
    },
    {
      version: '1.1.0',
      releaseDate: '2024-11-05',
      codename: 'Enhanced',
      description: 'Added export, import, search, analytics, and templates',
      breaking: false,
    },
    {
      version: '2.0.0',
      releaseDate: 'TBD',
      codename: 'Evolution',
      description: 'Major feature update (planned)',
      breaking: true,
    },
  ],
  
  // Data schema version for migrations
  dataSchemaVersion: '1.0.0',
  
  // Minimum compatible version for data import
  minCompatibleVersion: '1.0.0',
} as const;

/**
 * Release types
 */
export enum ReleaseType {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
}

/**
 * Version metadata interface
 */
export interface VersionMetadata {
  version: string;
  releaseDate: string;
  codename: string;
  description: string;
  breaking: boolean;
  features?: string[];
  fixes?: string[];
  deprecated?: string[];
}

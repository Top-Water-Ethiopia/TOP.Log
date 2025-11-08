/**
 * Data Migration System
 * Handles data structure migrations between versions
 */

import { compareVersions, getDataSchemaVersion } from './version';

/**
 * Migration function type
 */
export type MigrationFn = (data: any) => any;

/**
 * Migration definition
 */
export interface Migration {
  version: string;
  description: string;
  migrate: MigrationFn;
}

/**
 * Storage metadata for versioning
 */
export interface StorageMetadata {
  version: string;
  schemaVersion: string;
  lastMigrated?: string;
  migratedFrom?: string;
}

/**
 * Versioned storage wrapper
 */
export interface VersionedStorage<T> {
  metadata: StorageMetadata;
  data: T;
}

/**
 * Available migrations registry
 * Add new migrations here as the app evolves
 */
const MIGRATIONS: Migration[] = [
  // Example migration from 1.0.0 to 1.1.0
  {
    version: '1.1.0',
    description: 'Add metadata fields to entries',
    migrate: (data: any[]) => {
      return data.map((entry) => ({
        ...entry,
        // Ensure all entries have metadata fields
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
      }));
    },
  },
  // Future migrations will be added here
  // Example for version 2.0.0:
  // {
  //   version: '2.0.0',
  //   description: 'Add tags and categories to entries',
  //   migrate: (data: any[]) => {
  //     return data.map(entry => ({
  //       ...entry,
  //       tags: [],
  //       category: 'general'
  //     }));
  //   }
  // },
];

/**
 * Run all necessary migrations on data
 */
export function migrateData<T>(
  data: T,
  fromVersion: string,
  toVersion?: string
): T {
  const targetVersion = toVersion || getDataSchemaVersion();
  
  // Get all migrations that need to be applied
  const applicableMigrations = MIGRATIONS.filter((migration) => {
    return (
      compareVersions(migration.version, fromVersion) > 0 &&
      compareVersions(migration.version, targetVersion) <= 0
    );
  }).sort((a, b) => compareVersions(a.version, b.version));

  // Apply migrations in sequence
  let migratedData = data;
  for (const migration of applicableMigrations) {
    console.log(`Applying migration: ${migration.version} - ${migration.description}`);
    migratedData = migration.migrate(migratedData);
  }

  return migratedData;
}

/**
 * Wrap data with version metadata
 */
export function wrapWithMetadata<T>(data: T): VersionedStorage<T> {
  return {
    metadata: {
      version: getDataSchemaVersion(),
      schemaVersion: getDataSchemaVersion(),
      lastMigrated: new Date().toISOString(),
    },
    data,
  };
}

/**
 * Extract data from versioned storage
 */
export function unwrapVersionedStorage<T>(
  storage: VersionedStorage<T> | T
): { data: T; metadata?: StorageMetadata } {
  // Check if data is already versioned
  if (
    typeof storage === 'object' &&
    storage !== null &&
    'metadata' in storage &&
    'data' in storage
  ) {
    return {
      data: (storage as VersionedStorage<T>).data,
      metadata: (storage as VersionedStorage<T>).metadata,
    };
  }

  // Legacy data without versioning
  return { data: storage as T };
}

/**
 * Check if migration is needed
 */
export function needsMigration(
  fromVersion: string,
  toVersion?: string
): boolean {
  const targetVersion = toVersion || getDataSchemaVersion();
  return compareVersions(fromVersion, targetVersion) < 0;
}

/**
 * Get pending migrations
 */
export function getPendingMigrations(fromVersion: string): Migration[] {
  const targetVersion = getDataSchemaVersion();
  
  return MIGRATIONS.filter((migration) => {
    return (
      compareVersions(migration.version, fromVersion) > 0 &&
      compareVersions(migration.version, targetVersion) <= 0
    );
  }).sort((a, b) => compareVersions(a.version, b.version));
}

/**
 * Validate migration path
 */
export function isValidMigrationPath(fromVersion: string): boolean {
  try {
    const pending = getPendingMigrations(fromVersion);
    
    // Check if there are any breaking changes
    const hasBreakingChange = pending.some((migration) => {
      const [major] = migration.version.split('.').map(Number);
      const [fromMajor] = fromVersion.split('.').map(Number);
      return major > fromMajor;
    });

    // For now, allow all migrations
    // In the future, you might want to block certain paths
    return true;
  } catch (error) {
    console.error('Error validating migration path:', error);
    return false;
  }
}

/**
 * Create a backup before migration
 */
export function createMigrationBackup<T>(data: T, version: string): string {
  const backup = {
    version,
    timestamp: new Date().toISOString(),
    data,
  };
  
  return JSON.stringify(backup);
}

/**
 * Restore from migration backup
 */
export function restoreFromBackup<T>(backupString: string): {
  data: T;
  version: string;
  timestamp: string;
} {
  const backup = JSON.parse(backupString);
  return {
    data: backup.data,
    version: backup.version,
    timestamp: backup.timestamp,
  };
}

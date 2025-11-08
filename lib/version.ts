/**
 * Version Management Utilities
 * Handles version comparison, validation, and migration logic
 */

import { VERSION_CONFIG, VersionMetadata, ReleaseType } from '../version.config';

/**
 * Get current application version
 */
export function getCurrentVersion(): string {
  return VERSION_CONFIG.current;
}

/**
 * Get current data schema version
 */
export function getDataSchemaVersion(): string {
  return VERSION_CONFIG.dataSchemaVersion;
}

/**
 * Get all version history
 */
export function getVersionHistory(): readonly VersionMetadata[] {
  return VERSION_CONFIG.versions;
}

/**
 * Get specific version metadata
 */
export function getVersionMetadata(version: string): VersionMetadata | undefined {
  return VERSION_CONFIG.versions.find((v) => v.version === version);
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * Check if a version is compatible with current version
 */
export function isVersionCompatible(version: string): boolean {
  return compareVersions(version, VERSION_CONFIG.minCompatibleVersion) >= 0;
}

/**
 * Parse semantic version string
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

/**
 * Increment version based on release type
 */
export function incrementVersion(
  currentVersion: string,
  releaseType: ReleaseType
): string {
  const { major, minor, patch } = parseVersion(currentVersion);

  switch (releaseType) {
    case ReleaseType.MAJOR:
      return `${major + 1}.0.0`;
    case ReleaseType.MINOR:
      return `${major}.${minor + 1}.0`;
    case ReleaseType.PATCH:
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
}

/**
 * Check if an update is a breaking change
 */
export function isBreakingChange(fromVersion: string, toVersion: string): boolean {
  const from = parseVersion(fromVersion);
  const to = parseVersion(toVersion);
  return to.major > from.major;
}

/**
 * Get latest version from history
 */
export function getLatestVersion(): VersionMetadata | undefined {
  return VERSION_CONFIG.versions
    .filter((v) => v.releaseDate !== 'TBD')
    .sort((a, b) => compareVersions(b.version, a.version))[0];
}

/**
 * Get version display string with codename
 */
export function getVersionDisplay(version?: string): string {
  const versionToUse = version || getCurrentVersion();
  const metadata = getVersionMetadata(versionToUse);
  
  if (metadata?.codename) {
    return `v${versionToUse} "${metadata.codename}"`;
  }
  
  return `v${versionToUse}`;
}

/**
 * Format version for display
 */
export function formatVersion(version: string, includePrefix = true): string {
  return includePrefix ? `v${version}` : version;
}

/**
 * Validate version string format
 */
export function isValidVersion(version: string): boolean {
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

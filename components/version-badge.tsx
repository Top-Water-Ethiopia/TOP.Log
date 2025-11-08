/**
 * Version Badge Component
 * Displays the current application version
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { getVersionDisplay, getCurrentVersion } from '@/lib/version';

interface VersionBadgeProps {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  showCodename?: boolean;
  className?: string;
}

export function VersionBadge({
  variant = 'secondary',
  showCodename = true,
  className = '',
}: VersionBadgeProps) {
  const version = getCurrentVersion();
  const display = showCodename ? getVersionDisplay() : `v${version}`;

  return (
    <Badge variant={variant} className={className}>
      {display}
    </Badge>
  );
}

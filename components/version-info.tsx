/**
 * Version Info Component
 * Displays detailed version information and changelog
 */

'use client';

import { useState } from 'react';
import { Info, History, Clock, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getCurrentVersion,
  getVersionHistory,
  getVersionMetadata,
  getDataSchemaVersion,
} from '@/lib/version';

export function VersionInfo() {
  const [open, setOpen] = useState(false);
  const currentVersion = getCurrentVersion();
  const dataSchemaVersion = getDataSchemaVersion();
  const versionHistory = getVersionHistory();
  const currentMetadata = getVersionMetadata(currentVersion);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Info className="h-4 w-4" />
          v{currentVersion}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            TOP Log Version Information
          </DialogTitle>
          <DialogDescription>
            Application version details and release history
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current Version</TabsTrigger>
            <TabsTrigger value="history">Version History</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Version {currentVersion}
                    </h3>
                    {currentMetadata?.codename && (
                      <p className="text-sm text-muted-foreground">
                        Codename: "{currentMetadata.codename}"
                      </p>
                    )}
                  </div>
                  <Badge variant="default">Current</Badge>
                </div>
                {currentMetadata && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Released:</span>
                        <span className="font-medium">
                          {currentMetadata.releaseDate}
                        </span>
                      </div>
                      <p className="text-sm">{currentMetadata.description}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-semibold">Technical Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Application Version:
                    </span>
                    <span className="font-mono">{currentVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Data Schema Version:
                    </span>
                    <span className="font-mono">{dataSchemaVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Framework:</span>
                    <span className="font-mono">Next.js 16.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">React:</span>
                    <span className="font-mono">19.2.0</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {versionHistory.map((version, index) => (
                  <div
                    key={version.version}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">
                          Version {version.version}
                        </h4>
                        {version.codename && (
                          <Badge variant="outline" className="text-xs">
                            {version.codename}
                          </Badge>
                        )}
                      </div>
                      {version.version === currentVersion && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                      {version.breaking && (
                        <Badge variant="destructive" className="text-xs">
                          Breaking
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{version.releaseDate}</span>
                    </div>

                    <p className="text-sm">{version.description}</p>

                    {version.features && version.features.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Features:
                        </p>
                        <ul className="text-xs space-y-1 ml-4">
                          {version.features.map((feature, i) => (
                            <li key={i} className="list-disc">
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

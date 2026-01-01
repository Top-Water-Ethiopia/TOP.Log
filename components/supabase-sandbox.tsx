"use client";

import { useState } from "react";
import { useSupabaseAuth } from "@/contexts/supabase-auth-context";
import { useSupabaseLog } from "@/contexts/supabase-log-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SupabaseSandbox() {
  const { user, profile } = useSupabaseAuth();
  const { 
    addEntry, 
    updateEntry, 
    deleteEntry, 
    searchEntries, 
    entries,
    isLoading 
  } = useSupabaseLog();
  
  const [activeTab, setActiveTab] = useState("create");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [objectives, setObjectives] = useState("");
  const [keyResults, setKeyResults] = useState("");
  const [challenges, setChallenges] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  
  // Create Entry
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await addEntry({
        date,
        department_id: profile?.department_id ?? null,
        metadata: null,
        objectives,
        keyResults,
        challenges,
        developmentTasks: "",
        featuresCompleted: "",
        challengesAndBlockers: "",
        codeAndPriorities: "",
        systemImprovements: "",
        projectUpdates: "",
        createdAt: "",
        updatedAt: "",
        customResponses: [],
      });
      
      // Reset form
      setObjectives("");
      setKeyResults("");
      setChallenges("");
      
      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
      
      toast.success("Entry created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create entry");
    }
  };
  
  // Search Entries
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const results = await searchEntries(searchQuery);
      setSearchResults(results);
      
      if (results.length === 0) {
        toast.info("No entries found matching your search");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to search entries");
    }
  };
  
  // View Entry
  const handleViewEntry = (entry: any) => {
    setSelectedEntry(entry);
    setActiveTab("view");
  };
  
  // Delete Entry
  const handleDeleteEntry = async () => {
    if (!selectedEntry) return;
    
    try {
      await deleteEntry(selectedEntry.id);
      toast.success("Entry deleted successfully!");
      setSelectedEntry(null);
      setActiveTab("search");
      setSearchResults(searchResults.filter(e => e.id !== selectedEntry.id));
    } catch (error: any) {
      toast.error(error.message || "Failed to delete entry");
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supabase Integration Sandbox</CardTitle>
        <CardDescription>
          Try out the Supabase database integration with this interactive sandbox
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="text-center p-8">
            <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
            <p className="text-muted-foreground mb-4">
              Please log in to use the Supabase integration sandbox
            </p>
            <Button asChild>
              <a href="/login">Log in</a>
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="create">Create Entry</TabsTrigger>
              <TabsTrigger value="search">Search Entries</TabsTrigger>
              <TabsTrigger value="view" disabled={!selectedEntry}>View Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="objectives">Objectives</Label>
                  <Textarea
                    id="objectives"
                    placeholder="What do you aim to accomplish?"
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    required
                    className="min-h-20"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="keyResults">Key Results</Label>
                  <Textarea
                    id="keyResults"
                    placeholder="What results did you achieve?"
                    value={keyResults}
                    onChange={(e) => setKeyResults(e.target.value)}
                    required
                    className="min-h-20"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="challenges">Challenges</Label>
                  <Textarea
                    id="challenges"
                    placeholder="What challenges did you face?"
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    className="min-h-20"
                  />
                </div>
                
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Entry"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="search">
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Search entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? "Searching..." : "Search"}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">All Entries ({entries.length})</h3>
                  
                  <div className="border rounded-md divide-y">
                    {entries.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No entries found
                      </div>
                    ) : (
                      entries.slice(0, 5).map((entry) => (
                        <div 
                          key={entry.id} 
                          className="p-3 hover:bg-muted cursor-pointer"
                          onClick={() => handleViewEntry(entry)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{entry.date}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {entry.objectives || entry.developmentTasks}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">View</Button>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {entries.length > 5 && (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Showing 5 of {entries.length} entries
                      </div>
                    )}
                  </div>
                </div>
                
                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Search Results ({searchResults.length})</h3>
                    
                    <div className="border rounded-md divide-y">
                      {searchResults.map((entry) => (
                        <div 
                          key={entry.id} 
                          className="p-3 hover:bg-muted cursor-pointer"
                          onClick={() => handleViewEntry(entry)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">{entry.date}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {entry.objectives || entry.development_tasks}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm">View</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="view">
              {selectedEntry && (
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">Entry for {selectedEntry.date}</h2>
                      <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(selectedEntry.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleDeleteEntry}
                    >
                      Delete Entry
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {selectedEntry.objectives && (
                      <div>
                        <h3 className="text-lg font-medium">Objectives</h3>
                        <p className="mt-1 whitespace-pre-wrap">{selectedEntry.objectives}</p>
                      </div>
                    )}
                    
                    {selectedEntry.key_results && (
                      <div>
                        <h3 className="text-lg font-medium">Key Results</h3>
                        <p className="mt-1 whitespace-pre-wrap">{selectedEntry.key_results}</p>
                      </div>
                    )}
                    
                    {selectedEntry.challenges && (
                      <div>
                        <h3 className="text-lg font-medium">Challenges</h3>
                        <p className="mt-1 whitespace-pre-wrap">{selectedEntry.challenges}</p>
                      </div>
                    )}
                    
                    {/* Legacy fields */}
                    {selectedEntry.development_tasks && (
                      <div>
                        <h3 className="text-lg font-medium">Development Tasks</h3>
                        <p className="mt-1 whitespace-pre-wrap">{selectedEntry.development_tasks}</p>
                      </div>
                    )}
                    
                    {selectedEntry.features_completed && (
                      <div>
                        <h3 className="text-lg font-medium">Features Completed</h3>
                        <p className="mt-1 whitespace-pre-wrap">{selectedEntry.features_completed}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("search")}
                    >
                      Back to Search
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          Data is stored in your Supabase database
        </p>
        <Button variant="link" asChild>
          <a href="/supabase-test" target="_blank" rel="noopener noreferrer">
            Run Diagnostics
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

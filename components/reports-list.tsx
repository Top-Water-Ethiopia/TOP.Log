'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, User, ChevronDown, ChevronUp, Search, Download, Filter } from 'lucide-react';
import { format, startOfDay, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportAnswer {
  id: string;
  report_id: string;
  question_id: string;
  answer: string;
  created_at: string;
  report_questions: {
    id: string;
    question_key: string;
    question_label: string;
    question_type: string;
  };
}

interface Report {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  metadata: any;
  answers: ReportAnswer[];
  user_name: string;
  user_email: string | null;
}

export function ReportsList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/reports');
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to view reports');
          }
          throw new Error('Failed to fetch reports');
        }

        const data = await response.json();
        setReports(data);
      } catch (error) {
        console.error('Error fetching reports:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load reports',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [toast]);

  const toggleReport = (reportId: string) => {
    const newExpanded = new Set(expandedReports);
    if (newExpanded.has(reportId)) {
      newExpanded.delete(reportId);
    } else {
      newExpanded.add(reportId);
    }
    setExpandedReports(newExpanded);
  };

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    reports.forEach(report => {
      if (!users.has(report.user_id)) {
        users.set(report.user_id, report.user_name);
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [reports]);

  // Filter reports
  const filteredReports = useMemo(() => {
    let filtered = [...reports];

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(r => r.user_id === selectedUser);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = startOfDay(now);
      
      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(r => {
            const reportDate = startOfDay(parseISO(r.created_at));
            return reportDate.getTime() === today.getTime();
          });
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          filtered = filtered.filter(r => {
            const reportDate = parseISO(r.created_at);
            return reportDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filtered = filtered.filter(r => {
            const reportDate = parseISO(r.created_at);
            return reportDate >= monthAgo;
          });
          break;
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report => {
        // Search in user name
        if (report.user_name.toLowerCase().includes(query)) return true;
        // Search in answers
        return report.answers.some(answer => 
          answer.answer.toLowerCase().includes(query) ||
          answer.report_questions?.question_label?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [reports, selectedUser, dateFilter, searchQuery]);

  // Export reports to JSON
  const handleExport = () => {
    try {
      const exportData = filteredReports.map(report => ({
        id: report.id,
        user_name: report.user_name,
        user_email: report.user_email,
        created_at: report.created_at,
        answers: report.answers.map(answer => ({
          question: answer.report_questions?.question_label || answer.report_questions?.question_key,
          answer: answer.answer,
        })),
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reports-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Success',
        description: `Exported ${filteredReports.length} reports`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export reports',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No reports found</p>
        <p className="text-sm text-muted-foreground mt-2">
          Reports will appear here once users start submitting them.
        </p>
      </div>
    );
  }

  if (filteredReports.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No reports match your filters</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your search or filter criteria.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchQuery('');
            setSelectedUser('all');
            setDateFilter('all');
          }}
          className="mt-4"
        >
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Reports</h2>
          <p className="text-muted-foreground mt-1">
            {filteredReports.length} of {reports.length} reports
            {searchQuery || selectedUser !== 'all' || dateFilter !== 'all' ? ' (filtered)' : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filteredReports.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* User Filter */}
          <div className="space-y-2">
            <Label htmlFor="user-filter">User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user-filter">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div className="space-y-2">
            <Label htmlFor="date-filter">Date Range</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger id="date-filter">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clear filters */}
        {(searchQuery || selectedUser !== 'all' || dateFilter !== 'all') && (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedUser('all');
                setDateFilter('all');
              }}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear filters
            </Button>
          </div>
        )}
      </Card>

      {filteredReports.map((report) => {
        const isExpanded = expandedReports.has(report.id);
        const reportDate = new Date(report.created_at);

        return (
          <Card key={report.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleReport(report.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-lg">
                      {report.user_name}
                      {report.user_email && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({report.user_email})
                        </span>
                      )}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{format(reportDate, 'PPP')}</span>
                    </div>
                    <span>{report.answers.length} {report.answers.length === 1 ? 'answer' : 'answers'}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleReport(report.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-4 border-t pt-4">
                  {report.answers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No answers submitted for this report.</p>
                  ) : (
                    report.answers.map((answer) => (
                      <div key={answer.id} className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          {answer.report_questions?.question_label || answer.report_questions?.question_key || 'Question'}
                        </h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {answer.answer || <span className="italic">No answer provided</span>}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}


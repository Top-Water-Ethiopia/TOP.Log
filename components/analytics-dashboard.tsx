"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaptainLog } from "@/contexts/supabase-log-context"
import { Calendar, TrendingUp, CheckCircle, AlertCircle, Code, Zap, Monitor, Award, Construction, Search, Wrench, Megaphone, PartyPopper } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export function AnalyticsDashboard() {
  const { entries } = useCaptainLog()

  const analytics = useMemo(() => {
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        currentStreak: 0,
        longestStreak: 0,
        completionRate: 0,
        avgFieldsPerEntry: 0,
        mostProductiveDay: null,
        recentActivity: 0,
        sectionStats: {
          developmentTasks: 0,
          featuresCompleted: 0,
          challengesAndBlockers: 0,
          codeAndPriorities: 0,
          systemImprovements: 0,
          projectUpdates: 0,
        },
      }
    }

    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate streaks
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < sortedEntries.length; i++) {
      if (i > 0) {
        const prevDate = new Date(sortedEntries[i - 1].date)
        const currDate = new Date(sortedEntries[i].date)
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }

      // Check if this is part of current streak
      const entryDate = new Date(sortedEntries[i].date)
      const diffFromToday = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))

      if (diffFromToday <= i - sortedEntries.length + 1) {
        currentStreak = tempStreak
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak)

    // Calculate completion rate (entries with at least 4 fields filled)
    const completeEntries = entries.filter((entry) => {
      let filledFields = 0
      if (entry.developmentTasks.trim()) filledFields++
      if (entry.featuresCompleted.trim()) filledFields++
      if (entry.challengesAndBlockers.trim()) filledFields++
      if (entry.codeAndPriorities.trim()) filledFields++
      if (entry.systemImprovements.trim()) filledFields++
      if (entry.projectUpdates.trim()) filledFields++
      return filledFields >= 4
    })

    const completionRate = (completeEntries.length / entries.length) * 100

    // Calculate average fields per entry
    const totalFields = entries.reduce((sum, entry) => {
      let filledFields = 0
      if (entry.developmentTasks.trim()) filledFields++
      if (entry.featuresCompleted.trim()) filledFields++
      if (entry.challengesAndBlockers.trim()) filledFields++
      if (entry.codeAndPriorities.trim()) filledFields++
      if (entry.systemImprovements.trim()) filledFields++
      if (entry.projectUpdates.trim()) filledFields++
      return sum + filledFields
    }, 0)

    const avgFieldsPerEntry = totalFields / entries.length

    // Calculate section statistics
    const sectionStats = {
      developmentTasks: entries.filter((e) => e.developmentTasks.trim()).length,
      featuresCompleted: entries.filter((e) => e.featuresCompleted.trim()).length,
      challengesAndBlockers: entries.filter((e) => e.challengesAndBlockers.trim()).length,
      codeAndPriorities: entries.filter((e) => e.codeAndPriorities.trim()).length,
      systemImprovements: entries.filter((e) => e.systemImprovements.trim()).length,
      projectUpdates: entries.filter((e) => e.projectUpdates.trim()).length,
    }

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentActivity = entries.filter((e) => new Date(e.date) >= sevenDaysAgo).length

    return {
      totalEntries: entries.length,
      currentStreak,
      longestStreak,
      completionRate,
      avgFieldsPerEntry,
      recentActivity,
      sectionStats,
    }
  }, [entries])

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
          <CardDescription>Start logging to see your analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No data available yet. Create your first entry to see insights!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <span className="text-3xl font-bold">{analytics.totalEntries}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              <span className="text-3xl font-bold">{analytics.currentStreak}</span>
              <span className="text-muted-foreground">days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" style={{ color: '#099748' }} />
              <span className="text-3xl font-bold">{analytics.completionRate.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-3xl font-bold">{analytics.recentActivity}</span>
              <span className="text-muted-foreground text-sm">last 7 days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Section Usage</CardTitle>
          <CardDescription>How often you fill out each section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Monitor className="h-4 w-4" /> Development Tasks</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.developmentTasks}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.developmentTasks / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Award className="h-4 w-4" /> Features Completed</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.featuresCompleted}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.featuresCompleted / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Construction className="h-4 w-4" /> Challenges & Blockers</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.challengesAndBlockers}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.challengesAndBlockers / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Search className="h-4 w-4" /> Code Review & Priorities</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.codeAndPriorities}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.codeAndPriorities / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Wrench className="h-4 w-4" /> System Improvements</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.systemImprovements}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.systemImprovements / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2"><Megaphone className="h-4 w-4" /> Project Updates</span>
                <span className="text-sm text-muted-foreground">
                  {analytics.sectionStats.projectUpdates}/{analytics.totalEntries}
                </span>
              </div>
              <Progress
                value={(analytics.sectionStats.projectUpdates / analytics.totalEntries) * 100}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Logging Habits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Longest Streak</span>
              <span className="font-semibold">{analytics.longestStreak} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Fields Per Entry</span>
              <span className="font-semibold">{analytics.avgFieldsPerEntry.toFixed(1)} / 6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Complete Entries</span>
              <span className="font-semibold">{analytics.completionRate.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.currentStreak >= 7 && (
              <div className="flex items-start gap-2 text-sm">
                <Zap className="h-4 w-4 text-orange-500 mt-0.5" />
                <span className="flex items-center gap-1">Great job! You're on a {analytics.currentStreak}-day streak! <PartyPopper className="h-4 w-4" /></span>
              </div>
            )}
            {analytics.completionRate >= 80 && (
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 mt-0.5" style={{ color: '#099748' }} />
                <span>Excellent! You're filling out most sections consistently.</span>
              </div>
            )}
            {analytics.recentActivity === 0 && (
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                <span>No entries in the past 7 days. Time to log your progress!</span>
              </div>
            )}
            {analytics.totalEntries >= 30 && (
              <div className="flex items-start gap-2 text-sm">
                <Code className="h-4 w-4 text-blue-500 mt-0.5" />
                <span>You've logged {analytics.totalEntries} entries! You're building a great history.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

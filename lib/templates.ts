/**
 * Entry templates for quick logging
 */

export interface EntryTemplate {
  id: string
  name: string
  description: string
  icon: string
  fields: {
    developmentTasks: string
    featuresCompleted: string
    challengesAndBlockers: string
    codeAndPriorities: string
    systemImprovements: string
    projectUpdates: string
  }
}

export const templates: EntryTemplate[] = [
  {
    id: "productive-day",
    name: "Productive Day",
    description: "For days with lots of completed work",
    icon: "🚀",
    fields: {
      developmentTasks: "• Implemented new feature\n• Fixed critical bugs\n• Refactored legacy code",
      featuresCompleted: "• Feature X completed and merged\n• Bug fix for issue #123\n• Performance optimization",
      challengesAndBlockers: "None today - smooth sailing!",
      codeAndPriorities: "• Reviewed 3 PRs\n• Priority: Complete feature Y tomorrow",
      systemImprovements: "• Updated CI/CD pipeline\n• Improved test coverage",
      projectUpdates: "Sprint progressing well, on track for release",
    },
  },
  {
    id: "challenging-day",
    name: "Challenging Day",
    description: "For days with blockers and issues",
    icon: "🚧",
    fields: {
      developmentTasks: "• Investigated production issue\n• Attempted multiple fixes\n• Debugging complex problem",
      featuresCompleted: "Limited progress due to blockers",
      challengesAndBlockers:
        "• Production bug blocking deployment\n• Waiting for API documentation\n• Dependencies causing conflicts",
      codeAndPriorities: "• Need help from senior dev\n• Priority: Unblock deployment",
      systemImprovements: "N/A - focused on bug fixes",
      projectUpdates: "Delays expected, communicated with team",
    },
  },
  {
    id: "learning-day",
    name: "Learning Day",
    description: "For days focused on learning and research",
    icon: "📚",
    fields: {
      developmentTasks: "• Explored new technology\n• Read documentation\n• Built proof of concept",
      featuresCompleted: "• POC for new architecture completed\n• Research findings documented",
      challengesAndBlockers: "Steep learning curve, but making progress",
      codeAndPriorities: "• Priority: Share findings with team\n• Plan implementation strategy",
      systemImprovements: "• Documented best practices\n• Created tech evaluation report",
      projectUpdates: "Research phase for new initiative",
    },
  },
  {
    id: "meeting-heavy",
    name: "Meeting Heavy",
    description: "For days with many meetings",
    icon: "📅",
    fields: {
      developmentTasks: "• Limited coding time due to meetings\n• Quick bug fixes between sessions",
      featuresCompleted: "Minor updates only",
      challengesAndBlockers: "Limited dev time - many meetings scheduled",
      codeAndPriorities:
        "• Attended sprint planning\n• Project sync meetings\n• Priority: Catch up on dev work tomorrow",
      systemImprovements: "N/A",
      projectUpdates:
        "• Sprint planning completed\n• Team alignment on priorities\n• Clarified requirements for upcoming features",
    },
  },
  {
    id: "bug-fixing",
    name: "Bug Fixing Day",
    description: "Focused on fixing bugs and issues",
    icon: "🐛",
    fields: {
      developmentTasks: "• Bug triage and prioritization\n• Fixed multiple reported issues\n• Regression testing",
      featuresCompleted:
        "• Fixed bug #101\n• Fixed bug #102\n• Fixed bug #103\n• All fixes verified and merged",
      challengesAndBlockers: "Some bugs harder to reproduce than expected",
      codeAndPriorities: "• Reviewed related code for similar issues\n• Priority: Continue bug backlog tomorrow",
      systemImprovements: "• Added tests to prevent regression\n• Improved error handling",
      projectUpdates: "Bug count reduced significantly",
    },
  },
  {
    id: "code-review",
    name: "Code Review Day",
    description: "Heavy focus on reviewing code",
    icon: "👀",
    fields: {
      developmentTasks: "• Limited new development\n• Small refactoring tasks",
      featuresCompleted: "Code cleanup and minor improvements",
      challengesAndBlockers: "Large backlog of PRs to review",
      codeAndPriorities:
        "• Reviewed 5+ pull requests\n• Provided detailed feedback\n• Helped unblock teammates\n• Priority: Continue reviews tomorrow",
      systemImprovements: "• Suggested architectural improvements\n• Identified code patterns to refactor",
      projectUpdates: "Helping team maintain code quality and velocity",
    },
  },
  {
    id: "planning-day",
    name: "Planning Day",
    description: "Sprint/project planning and documentation",
    icon: "📝",
    fields: {
      developmentTasks: "• Technical spec writing\n• Architecture planning\n• Task breakdown",
      featuresCompleted: "Planning documents completed",
      challengesAndBlockers: "Need to finalize requirements before starting implementation",
      codeAndPriorities:
        "• Created technical design doc\n• Estimated story points\n• Priority: Start implementation next sprint",
      systemImprovements: "• Updated project documentation\n• Improved process documentation",
      projectUpdates:
        "• Sprint planning completed\n• Technical approach agreed upon\n• Team aligned on deliverables",
    },
  },
  {
    id: "deployment-day",
    name: "Deployment Day",
    description: "Release and deployment activities",
    icon: "🚀",
    fields: {
      developmentTasks: "• Final testing and verification\n• Deployment preparation\n• Post-deploy monitoring",
      featuresCompleted: "• Successfully deployed v1.2.0\n• All smoke tests passing\n• Production verified",
      challengesAndBlockers: "Minor deployment hiccup resolved quickly",
      codeAndPriorities: "• Monitored production metrics\n• Priority: Monitor for any issues",
      systemImprovements: "• Improved deployment process\n• Updated runbooks",
      projectUpdates: "🎉 Version 1.2.0 live in production!\n• New features available to users\n• Monitoring closely",
    },
  },
  {
    id: "blank",
    name: "Blank Template",
    description: "Start from scratch",
    icon: "📄",
    fields: {
      developmentTasks: "",
      featuresCompleted: "",
      challengesAndBlockers: "",
      codeAndPriorities: "",
      systemImprovements: "",
      projectUpdates: "",
    },
  },
]

export function getTemplateById(id: string): EntryTemplate | undefined {
  return templates.find((t) => t.id === id)
}

export function getTemplateCategories(): string[] {
  return ["All", "Productive", "Challenging", "Learning", "Administrative"]
}

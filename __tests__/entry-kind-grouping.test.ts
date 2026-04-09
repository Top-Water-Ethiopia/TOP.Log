import { describe, it, expect } from '@jest/globals'

/**
 * Entry Kind (Standard, Agent Call, Daily Summary) grouping and styling tests
 * These test the helper functions that group questions by entry_kind and apply styles
 */

// Types matching the component
type RoleQuestionWithRole = {
  id: string
  question_label: string
  question_type: string
  entry_kind?: string
  is_active: boolean
  is_required: boolean
  display_order: number
  department_id?: string | null
  department_profession_id?: string | null
  department_role?: string | null
  question_description?: string | null
  options?: string[]
}

// Helper function to group questions by entry_kind
function groupQuestionsByEntryKind(questions: RoleQuestionWithRole[]) {
  return {
    agentCall: questions.filter((q) => q.entry_kind === 'agent_call'),
    dailySummary: questions.filter((q) => q.entry_kind === 'daily_summary'),
    standard: questions.filter((q) => !q.entry_kind || q.entry_kind === 'standard'),
  }
}

// Helper function to get entry kind label and styles
function getEntryKindStyles(entryKind?: string) {
  switch (entryKind) {
    case 'agent_call':
      return {
        label: 'Agent Call',
        icon: 'Users',
        borderColor: 'border-l-blue-500',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        sectionBg: 'bg-blue-50/50',
      }
    case 'daily_summary':
      return {
        label: 'Daily Summary',
        icon: 'FileText',
        borderColor: 'border-l-green-500',
        badgeColor: 'bg-green-100 text-green-700 border-green-200',
        sectionBg: 'bg-green-50/50',
      }
    default:
      return {
        label: 'Standard',
        icon: 'FileText',
        borderColor: 'border-l-gray-400',
        badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
        sectionBg: 'bg-gray-50/50',
      }
  }
}

describe('Entry Kind Grouping', () => {
  const mockQuestions: RoleQuestionWithRole[] = [
    {
      id: '1',
      question_label: 'Agent Call Question 1',
      question_type: 'select',
      entry_kind: 'agent_call',
      is_active: true,
      is_required: true,
      display_order: 0,
    },
    {
      id: '2',
      question_label: 'Agent Call Question 2',
      question_type: 'text',
      entry_kind: 'agent_call',
      is_active: true,
      is_required: false,
      display_order: 1,
    },
    {
      id: '3',
      question_label: 'Daily Summary Question 1',
      question_type: 'textarea',
      entry_kind: 'daily_summary',
      is_active: true,
      is_required: true,
      display_order: 0,
    },
    {
      id: '4',
      question_label: 'Standard Question 1',
      question_type: 'text',
      entry_kind: 'standard',
      is_active: true,
      is_required: false,
      display_order: 0,
    },
    {
      id: '5',
      question_label: 'Standard Question 2',
      question_type: 'select',
      entry_kind: undefined,
      is_active: true,
      is_required: true,
      display_order: 1,
    },
    {
      id: '6',
      question_label: 'Another Daily Summary',
      question_type: 'text',
      entry_kind: 'daily_summary',
      is_active: false,
      is_required: false,
      display_order: 1,
    },
  ]

  describe('groupQuestionsByEntryKind', () => {
    it('should group agent_call questions correctly', () => {
      const result = groupQuestionsByEntryKind(mockQuestions)

      expect(result.agentCall).toHaveLength(2)
      expect(result.agentCall.map((q) => q.id)).toEqual(['1', '2'])
      expect(result.agentCall.every((q) => q.entry_kind === 'agent_call')).toBe(true)
    })

    it('should group daily_summary questions correctly', () => {
      const result = groupQuestionsByEntryKind(mockQuestions)

      expect(result.dailySummary).toHaveLength(2)
      expect(result.dailySummary.map((q) => q.id)).toEqual(['3', '6'])
      expect(result.dailySummary.every((q) => q.entry_kind === 'daily_summary')).toBe(true)
    })

    it('should group standard questions correctly (including undefined entry_kind)', () => {
      const result = groupQuestionsByEntryKind(mockQuestions)

      expect(result.standard).toHaveLength(2)
      expect(result.standard.map((q) => q.id)).toEqual(['4', '5'])
      expect(result.standard.every((q) => !q.entry_kind || q.entry_kind === 'standard')).toBe(true)
    })

    it('should handle empty questions array', () => {
      const result = groupQuestionsByEntryKind([])

      expect(result.agentCall).toHaveLength(0)
      expect(result.dailySummary).toHaveLength(0)
      expect(result.standard).toHaveLength(0)
    })

    it('should handle all agent_call questions', () => {
      const allAgentCall: RoleQuestionWithRole[] = [
        { id: '1', question_label: 'Q1', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: true, display_order: 0 },
        { id: '2', question_label: 'Q2', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: false, display_order: 1 },
      ]
      const result = groupQuestionsByEntryKind(allAgentCall)

      expect(result.agentCall).toHaveLength(2)
      expect(result.dailySummary).toHaveLength(0)
      expect(result.standard).toHaveLength(0)
    })

    it('should handle all undefined entry_kind as standard', () => {
      const allUndefined: RoleQuestionWithRole[] = [
        { id: '1', question_label: 'Q1', question_type: 'text', entry_kind: undefined, is_active: true, is_required: true, display_order: 0 },
        { id: '2', question_label: 'Q2', question_type: 'text', entry_kind: undefined, is_active: true, is_required: false, display_order: 1 },
      ]
      const result = groupQuestionsByEntryKind(allUndefined)

      expect(result.agentCall).toHaveLength(0)
      expect(result.dailySummary).toHaveLength(0)
      expect(result.standard).toHaveLength(2)
    })

    it('should preserve question properties when grouping', () => {
      const result = groupQuestionsByEntryKind(mockQuestions)

      const agentCallQ1 = result.agentCall.find((q) => q.id === '1')
      expect(agentCallQ1?.question_label).toBe('Agent Call Question 1')
      expect(agentCallQ1?.question_type).toBe('select')
      expect(agentCallQ1?.is_required).toBe(true)

      const dailySummaryQ1 = result.dailySummary.find((q) => q.id === '3')
      expect(dailySummaryQ1?.question_label).toBe('Daily Summary Question 1')
      expect(dailySummaryQ1?.question_type).toBe('textarea')
      expect(dailySummaryQ1?.is_active).toBe(true)
    })
  })

  describe('getEntryKindStyles', () => {
    it('should return correct styles for agent_call', () => {
      const styles = getEntryKindStyles('agent_call')

      expect(styles.label).toBe('Agent Call')
      expect(styles.icon).toBe('Users')
      expect(styles.borderColor).toBe('border-l-blue-500')
      expect(styles.badgeColor).toContain('bg-blue-100')
      expect(styles.badgeColor).toContain('text-blue-700')
      expect(styles.sectionBg).toBe('bg-blue-50/50')
    })

    it('should return correct styles for daily_summary', () => {
      const styles = getEntryKindStyles('daily_summary')

      expect(styles.label).toBe('Daily Summary')
      expect(styles.icon).toBe('FileText')
      expect(styles.borderColor).toBe('border-l-green-500')
      expect(styles.badgeColor).toContain('bg-green-100')
      expect(styles.badgeColor).toContain('text-green-700')
      expect(styles.sectionBg).toBe('bg-green-50/50')
    })

    it('should return standard styles for standard entry_kind', () => {
      const styles = getEntryKindStyles('standard')

      expect(styles.label).toBe('Standard')
      expect(styles.icon).toBe('FileText')
      expect(styles.borderColor).toBe('border-l-gray-400')
      expect(styles.badgeColor).toContain('bg-gray-100')
      expect(styles.badgeColor).toContain('text-gray-700')
      expect(styles.sectionBg).toBe('bg-gray-50/50')
    })

    it('should return standard styles for undefined entry_kind', () => {
      const styles = getEntryKindStyles(undefined)

      expect(styles.label).toBe('Standard')
      expect(styles.icon).toBe('FileText')
      expect(styles.borderColor).toBe('border-l-gray-400')
    })

    it('should return standard styles for unknown entry_kind', () => {
      const styles = getEntryKindStyles('unknown_kind')

      expect(styles.label).toBe('Standard')
      expect(styles.borderColor).toBe('border-l-gray-400')
    })

    it('should return standard styles for empty string', () => {
      const styles = getEntryKindStyles('')

      expect(styles.label).toBe('Standard')
      expect(styles.borderColor).toBe('border-l-gray-400')
    })

    it('should have distinct colors for each entry kind', () => {
      const agentCallStyles = getEntryKindStyles('agent_call')
      const dailySummaryStyles = getEntryKindStyles('daily_summary')
      const standardStyles = getEntryKindStyles('standard')

      // All should have different colors
      expect(agentCallStyles.badgeColor).not.toBe(dailySummaryStyles.badgeColor)
      expect(agentCallStyles.badgeColor).not.toBe(standardStyles.badgeColor)
      expect(dailySummaryStyles.badgeColor).not.toBe(standardStyles.badgeColor)

      expect(agentCallStyles.borderColor).not.toBe(dailySummaryStyles.borderColor)
      expect(agentCallStyles.borderColor).not.toBe(standardStyles.borderColor)
      expect(dailySummaryStyles.borderColor).not.toBe(standardStyles.borderColor)
    })
  })

  describe('Integration: Grouping and Styling', () => {
    it('should calculate section indices correctly for rendering', () => {
      const { agentCall, dailySummary, standard } = groupQuestionsByEntryKind(mockQuestions)

      // Agent call starts at index 0
      expect(agentCall.map((_, i) => i)).toEqual([0, 1])

      // Daily summary starts after agent call
      const dailySummaryStartIndex = agentCall.length
      expect(dailySummary.map((_, i) => dailySummaryStartIndex + i)).toEqual([2, 3])

      // Standard starts after agent call + daily summary
      const standardStartIndex = agentCall.length + dailySummary.length
      expect(standard.map((_, i) => standardStartIndex + i)).toEqual([4, 5])
    })

    it('should calculate active question counts per section', () => {
      const { agentCall, dailySummary, standard } = groupQuestionsByEntryKind(mockQuestions)

      const agentCallActive = agentCall.filter((q) => q.is_active).length
      const dailySummaryActive = dailySummary.filter((q) => q.is_active).length
      const standardActive = standard.filter((q) => q.is_active).length

      expect(agentCallActive).toBe(2)
      expect(dailySummaryActive).toBe(1) // One is inactive
      expect(standardActive).toBe(2)
    })

    it('should render section headers with correct counts', () => {
      const groups = groupQuestionsByEntryKind(mockQuestions)

      // Simulate header rendering
      const agentCallStyles = getEntryKindStyles('agent_call')
      const dailySummaryStyles = getEntryKindStyles('daily_summary')
      const standardStyles = getEntryKindStyles('standard')

      // Agent Call header
      expect(agentCallStyles.label).toBe('Agent Call')
      expect(groups.agentCall).toHaveLength(2)
      expect(groups.agentCall.filter((q) => q.is_active).length).toBe(2)

      // Daily Summary header
      expect(dailySummaryStyles.label).toBe('Daily Summary')
      expect(groups.dailySummary).toHaveLength(2)
      expect(groups.dailySummary.filter((q) => q.is_active).length).toBe(1)

      // Standard header
      expect(standardStyles.label).toBe('Standard')
      expect(groups.standard).toHaveLength(2)
      expect(groups.standard.filter((q) => q.is_active).length).toBe(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle mixed valid and invalid entry_kinds gracefully', () => {
      const mixedQuestions: RoleQuestionWithRole[] = [
        { id: '1', question_label: 'Q1', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: true, display_order: 0 },
        { id: '2', question_label: 'Q2', question_type: 'text', entry_kind: 'invalid_kind', is_active: true, is_required: false, display_order: 1 },
        { id: '3', question_label: 'Q3', question_type: 'text', entry_kind: 'daily_summary', is_active: true, is_required: false, display_order: 2 },
      ]

      const result = groupQuestionsByEntryKind(mixedQuestions)

      expect(result.agentCall).toHaveLength(1)
      expect(result.dailySummary).toHaveLength(1)
      // Invalid entry_kind falls into standard category
      expect(result.standard).toHaveLength(1)
      expect(result.standard[0].id).toBe('2')
    })

    it('should handle questions with all entry_kinds being the same', () => {
      const allStandard: RoleQuestionWithRole[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        question_label: `Question ${i + 1}`,
        question_type: 'text',
        entry_kind: 'standard',
        is_active: true,
        is_required: false,
        display_order: i,
      }))

      const result = groupQuestionsByEntryKind(allStandard)

      expect(result.standard).toHaveLength(10)
      expect(result.agentCall).toHaveLength(0)
      expect(result.dailySummary).toHaveLength(0)
    })

    it('should maintain display_order within each group', () => {
      const orderedQuestions: RoleQuestionWithRole[] = [
        { id: '1', question_label: 'Q1', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: true, display_order: 2 },
        { id: '2', question_label: 'Q2', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: false, display_order: 1 },
        { id: '3', question_label: 'Q3', question_type: 'text', entry_kind: 'agent_call', is_active: true, is_required: false, display_order: 0 },
      ]

      const result = groupQuestionsByEntryKind(orderedQuestions)

      expect(result.agentCall).toHaveLength(3)
      // Grouping preserves original order
      expect(result.agentCall.map((q) => q.display_order)).toEqual([2, 1, 0])
    })
  })
})

export { groupQuestionsByEntryKind, getEntryKindStyles }
export type { RoleQuestionWithRole }

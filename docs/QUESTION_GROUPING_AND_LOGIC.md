# Administrator Guide: Question Grouping and Conditional Logic

This guide explains how to organize log entry questions into steps and sections, and how to use conditional logic to create dynamic forms.

## 1. Question Grouping (Step-based)

Grouping questions allows you to break long forms into multiple pages or logical clusters within the same page.

### How to Group
In the **Role Questions Creator**:
1. Find the **Form Step / Page** field for a question.
2. Enter a numeric value (e.g., `1`, `2`, `3`).
3. All questions assigned to the same **Step Number** will appear on the same page in the multi-step log entry form.

> [!TIP]
> Use consecutive numbers starting from 1 for the best user experience.

---

## 2. Section Headers

Section headers provide visual hierarchy within a group of questions.

### How to Add a Header
1. In the **Section Header (Optional)** field, type the title of the section (e.g., "Personal Information").
2. This header will appear in bold text above the question in the reporting form.
3. Only the first question in a group needs a section header to label the entire block.

---

## 3. Conditional Visibility (Advanced)

Conditional logic allows you to show or hide questions based on the user's previous answers.

### Visibility Logic Rules
In the **Visibility Logic (JSON)** editor, you can define rules using this format:

```json
{
  "showIf": {
    "questionKey": "contact_successful",
    "operator": "equals",
    "value": "Yes"
  }
}
```

### Supported Operators
| Operator | Description | Example Value |
| :--- | :--- | :--- |
| `equals` | Shows if the answer is exactly X | `"Yes"` |
| `not_equals` | Shows if the answer is NOT X | `"No"` |
| `contains` | Shows if a checkbox list includes X | `"Urgent"` |
| `checked` | Shows if a checkbox is checked | (No value needed) |
| `not_checked` | Shows if a checkbox is unchecked | (No value needed) |

### Available Question Keys
The creator UI displays a list of **Available Keys** for the current set of questions. Use these keys in the `questionKey` field to link logic between questions.

> [!IMPORTANT]
> A question will always be hidden if its "showIf" condition is not met. If a whole page (Step) becomes empty because of hidden questions, the form will automatically skip that step.

---
*Created: 2026-04-14*

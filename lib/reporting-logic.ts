
export function evaluateConditionalLogic(logic: any, responses: Record<string, any>): boolean {
  if (!logic || !logic.showIf) return true

  const { questionKey, operator, value } = logic.showIf
  const responseValue = responses[questionKey]

  switch (operator) {
    case "equals":
      return String(responseValue) === String(value)
    case "not_equals":
      return String(responseValue) !== String(value)
    case "contains":
      if (Array.isArray(responseValue)) {
        return responseValue.some((v) => String(v) === String(value))
      }
      return String(responseValue).includes(String(value))
    case "checked":
      return responseValue === true
    case "not_checked":
      return responseValue === false
    default:
      return true
  }
}

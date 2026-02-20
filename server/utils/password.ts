const hasLower = (value: string) => /[a-z]/.test(value)
const hasUpper = (value: string) => /[A-Z]/.test(value)
const hasNumber = (value: string) => /\d/.test(value)
const hasSymbol = (value: string) => /[^A-Za-z0-9]/.test(value)

export const getPasswordScore = (value: string) => {
  const checks = [hasLower(value), hasUpper(value), hasNumber(value), hasSymbol(value)]
  const variety = checks.filter(Boolean).length
  const lengthScore = value.length >= 20 ? 3 : value.length >= 14 ? 2 : value.length >= 10 ? 1 : 0
  return variety + lengthScore
}

export const validatePassword = (value: string) => {
  const score = getPasswordScore(value)
  const valid = value.length >= 10 && score >= 4
  return { score, valid }
}

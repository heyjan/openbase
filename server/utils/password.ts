import bcrypt from 'bcryptjs'

const DUMMY_PASSWORD_HASH =
  '$2b$10$.LuG2FUmkegEkisyHEfmnu6GmfjBxqKjq5t9dAYoX/TbqyIWVceqK'

/**
 * Verify a password against a stored hash. When `hash` is null/undefined (the
 * account does not exist or has no credential), a comparison is still performed
 * against a throwaway hash so the response time does not reveal account
 * existence. Always returns false in that case.
 */
export const verifyPassword = async (
  password: string,
  hash: string | null | undefined
) => {
  const comparisonHash = hash || DUMMY_PASSWORD_HASH

  try {
    const matches = await bcrypt.compare(password, comparisonHash)
    return Boolean(hash) && matches
  } catch {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    return false
  }
}

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

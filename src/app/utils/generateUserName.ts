import { User } from "../modules/user/user.model"

const generateBaseUsername = (input: string): string => {
  // Normalize input, remove spaces, special chars, to lower case
  return input.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

export const generateUniqueUsername = async (input: string): Promise<string> => {
  let baseUsername = generateBaseUsername(input)
  let username = baseUsername
  let count = 0

  while (await User.exists({ username })) {
    count += 1
    username = `${baseUsername}${count}`
    if (count > 1000) throw new Error('Failed to generate unique username')
  }

  return username
}

export const generateDummyEmail = async (username: string): Promise<string> => {
  // Ensure no spaces or invalid chars in username
  const safeUsername = username.trim().toLowerCase().replace(/\s+/g, '')

  // Create dummy email
  const email = `${safeUsername}@gmail.com`

  return email
}
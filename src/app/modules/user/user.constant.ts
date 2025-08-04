export const USER_ROLE = {
  admin: 'admin',
  project_manager: 'project_manager',
  worker: 'worker',
} as const

export const REGISTER_WITH = {
  google: 'google',
  facebook: 'facebook',
  credentials: 'credentials',
}

export const USER_STATUS = {
  active: 'active',
  blocked: 'blocked',
} as const

export const registerWith = [
  REGISTER_WITH.google,
  REGISTER_WITH.facebook,
  REGISTER_WITH.credentials,
]

export type TUserRole = keyof typeof USER_ROLE
export type TUserStatus = keyof typeof USER_STATUS

export const UserSearchableFields = ['id', 'name', 'email', 'status']

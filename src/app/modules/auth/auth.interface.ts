export interface TRegisterUser {
  name: string
  email: string
  password: string
  role: 'admin' | 'worker' | 'project_manager'
}

export interface TLoginUser {
  email: string
  password: string
  fcmToken?: string 
}

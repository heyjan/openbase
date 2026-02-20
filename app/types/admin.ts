export interface AdminUser {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

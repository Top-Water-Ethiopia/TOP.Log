import { Database } from './database.types'

export interface UserProfile extends Database['public']['Tables']['user_profiles']['Row'] {
  roles?: {
    id: string
    name: string
    description: string | null
  }
}

export interface UserWithProfile {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  profile: {
    id: string
    name: string
    department: string | null
    role_id: string
    role_name: string
    is_active: boolean
    created_at: string
    last_login: string | null
  }
}

export interface PaginatedUsersResponse {
  data: UserWithProfile[]
  pagination: {
    page: number
    perPage: number
    totalCount: number
    totalPages: number
  }
}

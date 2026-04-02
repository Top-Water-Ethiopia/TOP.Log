import { Database } from "./database.types"

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"] & {
  roles?: {
    id: string
    name: string
    description: string | null
  }
}

export interface UserWithProfile {
  id: string
  email: string | null
  phone: string | null
  identifier: string
  email_confirmed_at: string | null
  user_metadata: {
    email_verified?: boolean
    [key: string]: any
  } | null
  created_at: string
  last_sign_in_at: string | null
  profile: {
    id: string
    name: string
    department_id: string | null
    role_id: string
    role_name: string
    profession_role_id?: string | null
    profession_role_name?: string | null
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

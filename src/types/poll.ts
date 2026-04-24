export interface Poll {
  id: string
  title: string
  slug: string
  is_open: boolean
  creator_id: string | null
  created_at: string
}

export interface PollOption {
  id: string
  poll_id: string
  text: string
}

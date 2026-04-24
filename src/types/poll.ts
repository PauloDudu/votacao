export interface Poll {
  id: string
  title: string
  slug: string
  is_open: boolean
  created_at: string
}

export interface PollOption {
  id: string
  poll_id: string
  text: string
}

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

export interface Vote {
  id: string
  option_id: string
  poll_id: string
  voter_id: string
  created_at: string
}

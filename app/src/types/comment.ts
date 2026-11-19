/** A fan comment as the moderation page sees it (GET /api/admin/comments). */
export interface AdminComment {
  id: number
  body: string
  created_at: string
  /** Set = not shown on the public site. */
  hidden_at: string | null
  post: { id: number; title: string }
  fan: {
    id: number
    /** The public author name; null only for a fan who has never commented. */
    display_name: string | null
    email: string | null
    /** Set = this fan cannot comment, and none of their comments are shown. */
    comments_blocked_at: string | null
  }
}

/** How many comments one fan may post in a period (GET/PUT /api/admin/comment-settings). */
export interface CommentLimit {
  max: number
  minutes: number
}

/** Laravel's paginator, as far as the page reads it. */
export interface AdminCommentsPage {
  data: AdminComment[]
  current_page: number
  last_page: number
  total: number
}

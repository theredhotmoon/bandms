export interface NewsletterSubscriber {
  id: number
  email: string
  name: string | null
  source: string | null
  subscribed_at: string
  confirmed_at: string | null
}

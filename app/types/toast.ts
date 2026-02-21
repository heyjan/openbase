export type ToastTone = 'success' | 'error' | 'info'

export type ToastMessage = {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

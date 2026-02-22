import type { ToastMessage, ToastTone } from '~/types/toast'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

const makeToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useAppToast = () => {
  const toasts = useState<ToastMessage[]>('toast-messages', () => [])

  const dismiss = (id: string) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  const push = (options: {
    tone: ToastTone
    title: string
    description?: string
    durationMs?: number
  }) => {
    const id = makeToastId()
    const durationMs = options.durationMs ?? 3500

    toasts.value = [
      ...toasts.value,
      {
        id,
        tone: options.tone,
        title: options.title,
        description: options.description
      }
    ]

    if (process.client && durationMs > 0) {
      const timer = setTimeout(() => {
        dismiss(id)
      }, durationMs)
      timers.set(id, timer)
    }

    return id
  }

  const success = (title: string, description?: string, durationMs?: number) =>
    push({ tone: 'success', title, description, durationMs })

  const error = (title: string, description?: string, durationMs?: number) =>
    push({ tone: 'error', title, description, durationMs })

  const info = (title: string, description?: string, durationMs?: number) =>
    push({ tone: 'info', title, description, durationMs })

  const clear = () => {
    for (const id of Array.from(timers.keys())) {
      dismiss(id)
    }
    toasts.value = []
  }

  return {
    toasts,
    push,
    success,
    error,
    info,
    dismiss,
    clear
  }
}

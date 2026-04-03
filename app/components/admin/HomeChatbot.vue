<script setup lang="ts">
type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

const prompt = ref('')
const messages = ref<ChatMessage[]>([
  {
    id: 'assistant-intro',
    role: 'assistant',
    content: 'Ask about dashboards, saved queries, or data sources.'
  }
])

const submitPrompt = () => {
  const text = prompt.value.trim()
  if (!text) {
    return
  }

  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text
  })

  prompt.value = ''

  messages.value.push({
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: 'AI responses are currently disabled in this environment.'
  })
}
</script>

<template>
  <section class="flex h-[80vh] flex-col rounded border border-gray-200 bg-white p-6 shadow-sm">
    <h2 class="text-xl font-semibold tracking-tight text-gray-900">AI Chatbot</h2>

    <div class="mt-6 flex min-h-0 flex-1 flex-col gap-4 rounded border border-gray-200 bg-gray-50 p-4">
      <div class="flex-1 space-y-3 overflow-y-auto">
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.role === 'assistant' ? 'justify-start' : 'justify-end'"
        >
          <div
            class="max-w-[90%] rounded px-3 py-2 text-sm"
            :class="message.role === 'assistant' ? 'bg-white text-gray-700' : 'bg-brand-secondary text-white'"
          >
            {{ message.content }}
          </div>
        </div>
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="submitPrompt">
        <UTextarea
          v-model="prompt"
          placeholder="Ask anything"
          :rows="3"
          autoresize
        />
        <div class="flex justify-end">
          <UButton type="submit" color="neutral" variant="outline">
            Send
          </UButton>
        </div>
      </form>
    </div>
  </section>
</template>

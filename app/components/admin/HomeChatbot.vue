<script setup lang="ts">
type ChatArtifact = {
  shareUrl?: string
  sql?: string
  preview?: {
    columns: string[]
    rows: Record<string, unknown>[]
  }
  steps?: string[]
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  artifact?: ChatArtifact
}

type AgentChatResult = {
  message: string
  shareUrl: string
  sql: string
  preview: {
    columns: string[]
    rows: Record<string, unknown>[]
  }
  steps: string[]
}

const prompt = ref('')
const pending = ref(false)
const errorMessage = ref('')
const messages = ref<ChatMessage[]>([
  {
    id: 'assistant-intro',
    role: 'assistant',
    content: 'Ask about dashboards, saved queries, or data sources.'
  }
])

const cellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const submitPrompt = async () => {
  const text = prompt.value.trim()
  if (!text || pending.value) {
    return
  }

  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    content: text
  })

  prompt.value = ''
  pending.value = true
  errorMessage.value = ''

  try {
    const result = await $fetch<AgentChatResult>('/api/admin/ai/chat', {
      method: 'POST',
      body: { message: text }
    })

    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.message,
      artifact: {
        shareUrl: result.shareUrl,
        sql: result.sql,
        preview: result.preview,
        steps: result.steps
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent request failed'
    errorMessage.value = message
    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: message
    })
  } finally {
    pending.value = false
  }
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
            <p>{{ message.content }}</p>

            <div v-if="message.artifact?.steps?.length" class="mt-3 border-t border-gray-100 pt-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Steps</p>
              <ol class="mt-2 list-decimal space-y-1 pl-4 text-xs text-gray-600">
                <li v-for="step in message.artifact.steps" :key="step">{{ step }}</li>
              </ol>
            </div>

            <div v-if="message.artifact?.shareUrl" class="mt-3">
              <a
                :href="message.artifact.shareUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
              >
                Open shared dashboard
              </a>
            </div>

            <pre
              v-if="message.artifact?.sql"
              class="mt-3 max-h-56 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-100"
            >{{ message.artifact.sql }}</pre>

            <div
              v-if="message.artifact?.preview?.columns?.length"
              class="mt-3 max-w-full overflow-auto rounded border border-gray-200"
            >
              <table class="min-w-full text-left text-xs">
                <thead class="bg-gray-100 text-gray-600">
                  <tr>
                    <th
                      v-for="column in message.artifact.preview.columns"
                      :key="column"
                      class="px-2 py-1 font-medium"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr v-for="(row, rowIndex) in message.artifact.preview.rows" :key="rowIndex">
                    <td
                      v-for="column in message.artifact.preview.columns"
                      :key="column"
                      class="whitespace-nowrap px-2 py-1 text-gray-700"
                    >
                      {{ cellValue(row[column]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="pending" class="flex justify-start">
          <div class="rounded bg-white px-3 py-2 text-sm text-gray-500">
            Creating dashboard...
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <form class="flex flex-col gap-3" @submit.prevent="submitPrompt">
        <UTextarea
          v-model="prompt"
          placeholder="Ask anything"
          :rows="3"
          autoresize
          :disabled="pending"
        />
        <div class="flex justify-end">
          <UButton type="submit" color="neutral" variant="outline" :disabled="pending">
            {{ pending ? 'Working...' : 'Send' }}
          </UButton>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const form = reactive({ name: '', email: '', subject: '', message: '' })
const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const errorMsg = ref('')

async function submit() {
  if (status.value === 'sending') return
  status.value = 'sending'
  errorMsg.value = ''
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = (await res.json()) as { message?: string }
      throw new Error(data.message ?? 'Something went wrong')
    }
    status.value = 'sent'
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e instanceof Error ? e.message : 'Something went wrong'
  }
}
</script>

<template>
  <div>
    <div v-if="status === 'sent'" class="rounded-xl border border-green-800 bg-green-900/20 p-6 text-center">
      <p class="text-lg font-semibold text-green-400">Message sent!</p>
      <p class="mt-1 text-sm text-zinc-400">We'll get back to you as soon as possible.</p>
    </div>

    <form v-else @submit.prevent="submit" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="contact-name" class="block text-sm font-medium text-zinc-300 mb-1.5">Name</label>
          <input
            id="contact-name"
            v-model="form.name"
            type="text"
            required
            autocomplete="name"
            placeholder="Your name"
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label for="contact-email" class="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
          <input
            id="contact-email"
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            placeholder="your@email.com"
            class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label for="contact-subject" class="block text-sm font-medium text-zinc-300 mb-1.5">Subject</label>
        <input
          id="contact-subject"
          v-model="form.subject"
          type="text"
          required
          placeholder="Booking inquiry, press request…"
          class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label for="contact-message" class="block text-sm font-medium text-zinc-300 mb-1.5">Message</label>
        <textarea
          id="contact-message"
          v-model="form.message"
          required
          rows="5"
          placeholder="Tell us about your event, festival, or collaboration idea…"
          class="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-accent focus:outline-none transition-colors resize-none"
        />
      </div>

      <div v-if="status === 'error'" class="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
        {{ errorMsg || 'Something went wrong. Please try again.' }}
      </div>

      <button
        type="submit"
        :disabled="status === 'sending'"
        class="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-bold text-black hover:bg-accent-dark disabled:opacity-60 transition-colors"
      >
        <span v-if="status === 'sending'">Sending…</span>
        <span v-else>Send Message</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BandMember } from '@/types/bandMember'
import type { GigLineup, GigRegularMember, GigTempMusician } from '@/types/stagePlot'

interface Props {
  modelValue: GigLineup
  bandMembers: BandMember[]
}
const props = defineProps<Props>()
const emit  = defineEmits<{
  'update:modelValue': [GigLineup]
  close: []
}>()

const currentMembers = computed(() => props.bandMembers.filter(m => m.is_current))

// Availability helpers
function isAvailable(memberId: number): boolean {
  const entry = props.modelValue.regular_members.find(m => m.band_member_id === memberId)
  return entry ? entry.is_available : true
}

function toggleMember(memberId: number) {
  const wasAvailable = isAvailable(memberId)
  const existing     = props.modelValue.regular_members.find(m => m.band_member_id === memberId)
  let updated: GigRegularMember[]

  if (existing) {
    updated = props.modelValue.regular_members.map(m =>
      m.band_member_id === memberId ? { ...m, is_available: !m.is_available } : m,
    )
  } else {
    updated = [
      ...props.modelValue.regular_members,
      { band_member_id: memberId, is_available: !wasAvailable },
    ]
  }

  emit('update:modelValue', { ...props.modelValue, regular_members: updated })
}

// Temp musicians
const showTempForm = ref(false)
const tempName     = ref('')
const tempRole     = ref('')

function addTempMusician() {
  if (!tempName.value.trim()) return
  const temp: GigTempMusician = {
    id:   `temp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: tempName.value.trim(),
    role: tempRole.value.trim(),
  }
  emit('update:modelValue', {
    ...props.modelValue,
    temp_musicians: [...props.modelValue.temp_musicians, temp],
  })
  tempName.value    = ''
  tempRole.value    = ''
  showTempForm.value = false
}

function removeTempMusician(id: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    temp_musicians: props.modelValue.temp_musicians.filter(t => t.id !== id),
  })
}

const availableCount = computed(() =>
  currentMembers.value.filter(m => isAvailable(m.id)).length +
  props.modelValue.temp_musicians.length,
)

function initials(m: BandMember): string {
  return `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h3 class="text-base font-semibold text-white">Who's playing at this gig?</h3>
      <p class="text-xs text-slate-400 mt-0.5">Toggle members off if they won't be attending. Add replacement musicians as needed.</p>
    </div>

    <!-- Band members grid -->
    <div>
      <p class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Band members</p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="member in currentMembers"
          :key="member.id"
          type="button"
          class="flex items-center gap-3 p-3 rounded-lg border transition-all text-left"
          :class="isAvailable(member.id)
            ? 'border-indigo-500/50 bg-indigo-950/40 text-white'
            : 'border-slate-700/50 bg-slate-800/30 text-slate-500 opacity-60'"
          @click="toggleMember(member.id)"
        >
          <!-- Avatar -->
          <div
            class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden"
            :class="isAvailable(member.id) ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-400'"
          >
            <img
              v-if="member.photo"
              :src="member.photo"
              :alt="member.first_name"
              class="w-full h-full object-cover"
            />
            <span v-else>{{ initials(member) }}</span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">
              {{ member.nickname ?? `${member.first_name} ${member.last_name}` }}
            </div>
            <div class="text-xs truncate" :class="isAvailable(member.id) ? 'text-slate-400' : 'text-slate-600'">
              {{ member.role ?? 'Musician' }}
            </div>
          </div>

          <!-- Status icon -->
          <div class="flex-shrink-0">
            <svg v-if="isAvailable(member.id)" class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </button>
      </div>
    </div>

    <!-- Temp musicians -->
    <div>
      <p class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Temporary / Replacement musicians</p>

      <!-- Existing temp musicians -->
      <div v-if="modelValue.temp_musicians.length" class="space-y-2 mb-3">
        <div
          v-for="temp in modelValue.temp_musicians"
          :key="temp.id"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-amber-600/30 bg-amber-950/20"
        >
          <div class="w-8 h-8 rounded-full bg-amber-800/60 text-amber-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {{ temp.name[0]?.toUpperCase() ?? '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-amber-200">{{ temp.name }}</div>
            <div class="text-xs text-amber-400/70">{{ temp.role || 'Replacement' }}</div>
          </div>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-800/50 text-amber-300 font-medium mr-1">GUEST</span>
          <button
            type="button"
            class="text-slate-500 hover:text-red-400 transition-colors p-1"
            @click="removeTempMusician(temp.id)"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Add temp form -->
      <div v-if="showTempForm" class="p-3 rounded-lg border border-slate-700 bg-slate-800/40 space-y-2">
        <input
          v-model="tempName"
          type="text"
          placeholder="Full name"
          class="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          @keyup.enter="addTempMusician"
        />
        <input
          v-model="tempRole"
          type="text"
          placeholder="Role / Position (e.g. Guitar, Bass)"
          class="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          @keyup.enter="addTempMusician"
        />
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="!tempName.trim()"
            class="flex-1 py-1.5 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            @click="addTempMusician"
          >Add musician</button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md border border-slate-700 transition-colors"
            @click="showTempForm = false; tempName = ''; tempRole = ''"
          >Cancel</button>
        </div>
      </div>

      <button
        v-else
        type="button"
        class="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors px-1"
        @click="showTempForm = true"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add temporary musician
      </button>
    </div>

    <!-- Summary + close -->
    <div class="flex items-center justify-between pt-2 border-t border-slate-700/50">
      <span class="text-sm text-slate-400">
        <span class="font-medium text-white">{{ availableCount }}</span> musician{{ availableCount !== 1 ? 's' : '' }} in tonight's lineup
      </span>
      <button
        type="button"
        :disabled="availableCount === 0"
        class="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        @click="emit('close')"
      >
        Done — place on stage →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ManagedUser } from '@/types/user'

/**
 * One user's assistant access on the Users page: Translate, Enhance and the
 * superadmin flag. Only a superadmin may change them (the API 403s anyone
 * else); a regular admin sees them read-only. A superadmin has both features
 * whatever their switches say, so those show as on and locked.
 */
export type AccessField = 'can_translate' | 'can_enhance' | 'is_superadmin'

const props = defineProps<{ user: ManagedUser; editable: boolean; busy?: boolean }>()
const emit = defineEmits<{ change: [field: AccessField, value: boolean] }>()

const { t } = useI18n()

const switches: { field: AccessField; label: string }[] = [
  { field: 'can_translate', label: 'more.users.access.translate' },
  { field: 'can_enhance', label: 'more.users.access.enhance' },
  { field: 'is_superadmin', label: 'more.users.access.superadmin' },
]

const isOn = (field: AccessField): boolean =>
  field === 'is_superadmin' ? props.user.is_superadmin : props.user.is_superadmin || props.user[field]

// A superadmin's feature switches are implied, not stored choices; and only an
// admin can be a superadmin (anyone else never reaches the Users page).
const isLocked = (field: AccessField): boolean =>
  !props.editable || !!props.busy
  || (field !== 'is_superadmin' && props.user.is_superadmin)
  || (field === 'is_superadmin' && props.user.role !== 'admin' && !props.user.is_superadmin)

function title(field: AccessField): string {
  if (!props.editable) return t('more.users.access.readOnly')
  return field === 'is_superadmin' ? t('more.users.access.superadminHint') : ''
}
</script>

<template>
  <div class="access">
    <button
      v-for="s in switches"
      :key="s.field"
      type="button"
      role="switch"
      class="access-switch"
      :class="{ 'access-switch--on': isOn(s.field), 'access-switch--star': s.field === 'is_superadmin' }"
      :aria-checked="isOn(s.field) ? 'true' : 'false'"
      :aria-label="$t(s.label)"
      :data-field="s.field"
      :disabled="isLocked(s.field)"
      :title="title(s.field)"
      @click="emit('change', s.field, !isOn(s.field))"
    >
      <span class="access-switch__track" aria-hidden="true"><span class="access-switch__thumb" /></span>
      <span class="access-switch__label">{{ $t(s.label) }}</span>
    </button>
  </div>
</template>

<style scoped>
.access { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; }
.access-switch {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0; border: none; background: transparent; cursor: pointer;
  color: var(--c-94a3b8); font-size: var(--fs-xs);
}
.access-switch:disabled { cursor: not-allowed; opacity: 0.55; }
.access-switch__track {
  position: relative; width: 1.75rem; height: 1rem; border-radius: 999px;
  background: var(--c-2a2a2a); transition: background 120ms;
}
.access-switch__thumb {
  position: absolute; top: 0.125rem; left: 0.125rem; width: 0.75rem; height: 0.75rem;
  border-radius: 999px; background: var(--c-e2e8f0); transition: transform 120ms;
}
.access-switch--on .access-switch__track { background: var(--c-0d9488); }
.access-switch--on .access-switch__thumb { transform: translateX(0.75rem); }
.access-switch--star.access-switch--on .access-switch__track { background: var(--c-f59e0b); }
.access-switch:focus-visible { outline: 2px solid var(--c-e2e8f0); outline-offset: 2px; border-radius: 0.25rem; }
</style>

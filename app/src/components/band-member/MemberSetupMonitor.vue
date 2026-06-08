<script setup lang="ts">
import type { MemberMonitorPrefs } from '@/types/bandMemberSetup'

interface Props { modelValue: MemberMonitorPrefs }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: MemberMonitorPrefs] }>()

function update(field: keyof MemberMonitorPrefs, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="monitor-section">
    <div class="hint">
      Define how you want your stage monitoring set up. IEM details feed into the RF / Wireless section.
    </div>

    <div class="form-grid">

      <!-- Type -->
      <div class="field-group">
        <label class="field-label">Monitor type</label>
        <div class="type-buttons">
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--on': modelValue.type === 'wedge' }"
            @click="update('type', 'wedge')"
          >🔊 Wedge monitor</button>
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--on': modelValue.type === 'iem' }"
            @click="update('type', 'iem')"
          >🎧 IEM</button>
        </div>
      </div>

      <!-- Config -->
      <div class="field-group">
        <label class="field-label">Configuration</label>
        <div class="type-buttons">
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--on': modelValue.config === 'mono' }"
            @click="update('config', 'mono')"
          >Mono</button>
          <button
            type="button"
            class="type-btn"
            :class="{ 'type-btn--on': modelValue.config === 'stereo' }"
            @click="update('config', 'stereo')"
          >Stereo</button>
        </div>
      </div>

      <!-- Mix description -->
      <div class="field-group field-group--wide">
        <label class="field-label">Mix description — what do you want to hear?</label>
        <input
          :value="modelValue.mix_description"
          class="field-input"
          placeholder="e.g. my vocals loud + kick, no guitars, click track on left"
          @input="update('mix_description', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- IEM-specific -->
      <template v-if="modelValue.type === 'iem'">
        <div class="field-group">
          <label class="field-label">Wireless pack</label>
          <label class="toggle-label">
            <input
              type="checkbox"
              :checked="modelValue.iem_own_pack"
              class="toggle-input"
              @change="update('iem_own_pack', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-text">
              {{ modelValue.iem_own_pack ? 'I bring my own pack' : 'Need venue pack' }}
            </span>
          </label>
        </div>

        <div class="field-group">
          <label class="field-label">Transmitter model</label>
          <input
            :value="modelValue.iem_transmitter_model"
            class="field-input"
            placeholder="e.g. Shure PSM300"
            @input="update('iem_transmitter_model', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="field-group">
          <label class="field-label">Frequency (MHz)</label>
          <input
            :value="modelValue.iem_frequency"
            class="field-input"
            placeholder="e.g. 606.000"
            @input="update('iem_frequency', ($event.target as HTMLInputElement).value)"
          />
          <p class="field-hint">Will appear in the RF / Wireless list when applied to a tech rider.</p>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.monitor-section { display: flex; flex-direction: column; gap: 0.75rem; }
.hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.72rem; font-weight: 600; color: #7c8fa6; }
.field-hint  { font-size: 0.68rem; color: #334155; margin-top: 0.15rem; }

.field-input {
  display: block; width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }

.type-buttons { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.type-btn {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: #141414; border: 1px solid #2a2a2a; color: #64748b;
  transition: background 100ms, border-color 100ms, color 100ms;
}
.type-btn:hover  { border-color: #555555; color: #94a3b8; }
.type-btn--on    { background: #2a2a2a; border-color: #888888; color: #d0d0d0; }

.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.25rem; }
.toggle-input { accent-color: #888888; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text  { font-size: 0.8rem; color: #94a3b8; }
</style>

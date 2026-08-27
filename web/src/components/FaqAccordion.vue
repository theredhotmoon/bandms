<script setup lang="ts">
import { ref } from 'vue'

export interface FaqItem {
  id: number
  question: string
  answer: string
}

const props = withDefaults(
  defineProps<{
    items: FaqItem[]
    /** Index open on load. -1 for all closed. The design opens the first. */
    initialOpen?: number
  }>(),
  { initialOpen: 0 },
)

const open = ref(props.initialOpen)

function toggle(i: number) {
  open.value = open.value === i ? -1 : i
}
</script>

<template>
  <div class="faq">
    <div v-for="(item, i) in items" :key="item.id" class="faq-row">
      <h3 class="faq-h">
        <button
          type="button"
          class="faq-q"
          :aria-expanded="open === i"
          :aria-controls="`faq-panel-${item.id}`"
          :id="`faq-button-${item.id}`"
          @click="toggle(i)"
        >
          <span>{{ item.question }}</span>
          <span class="faq-mark" :class="{ 'is-open': open === i }" aria-hidden="true">
            {{ open === i ? '–' : '+' }}
          </span>
        </button>
      </h3>
      <div
        v-show="open === i"
        :id="`faq-panel-${item.id}`"
        role="region"
        :aria-labelledby="`faq-button-${item.id}`"
      >
        <p class="faq-a">{{ item.answer }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq { border-top: var(--border-width-card) solid var(--color-border); }
.faq-row { border-bottom: var(--border-width-card) solid var(--color-border); }

/* The trigger lives inside a heading so the accordion is navigable by heading
   as well as by tab — an FAQ is a list of questions, not a list of buttons. */
.faq-h { margin: 0; font: inherit; }

.faq-q {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 4px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-body);
  font: var(--display-weight) 26px/1.05 var(--font-display);
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
}
.faq-q:focus-visible { outline: 3px solid var(--color-accent); outline-offset: 2px; }

.faq-mark {
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border: 2.5px solid var(--color-border);
  font: 800 22px/1 var(--font-body);
  transition: background .12s, color .12s;
}
.faq-mark.is-open { background: var(--color-accent); color: var(--color-on-accent); }

.faq-a {
  margin: 0 4px 24px;
  max-width: 760px;
  font: 500 17px/1.6 var(--font-body);
  color: var(--color-body);
  text-wrap: pretty;
}

@media (max-width: 700px) {
  .faq-q { font-size: 20px; padding: 18px 2px; gap: 12px; }
  .faq-a { font-size: 15px; }
}
</style>

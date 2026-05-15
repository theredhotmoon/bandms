<script setup lang="ts">
// @ts-nocheck — Tiptap Editor type doesn't resolve correctly in this monorepo structure
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const props = defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [StarterKit],
  editorProps: {
    attributes: { spellcheck: 'false' },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value) return
    if (editor.value.getHTML() !== val) {
      editor.value.commands.setContent(val ?? '')
    }
  },
)

onBeforeUnmount(() => editor.value?.destroy())

function cmd(action: () => void) {
  action()
}
</script>

<template>
  <div class="rich-editor-wrap">
    <!-- Toolbar -->
    <div class="toolbar" v-if="editor">
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('bold') }"
        @click="cmd(() => editor!.chain().focus().toggleBold().run())" title="Bold (Ctrl+B)">
        <strong>B</strong>
      </button>
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('italic') }"
        @click="cmd(() => editor!.chain().focus().toggleItalic().run())" title="Italic (Ctrl+I)">
        <em>I</em>
      </button>
      <div class="tb-divider" />
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('heading', { level: 2 }) }"
        @click="cmd(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())" title="Heading 2">
        H2
      </button>
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('heading', { level: 3 }) }"
        @click="cmd(() => editor!.chain().focus().toggleHeading({ level: 3 }).run())" title="Heading 3">
        H3
      </button>
      <div class="tb-divider" />
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('bulletList') }"
        @click="cmd(() => editor!.chain().focus().toggleBulletList().run())" title="Bullet list">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
          <line x1="9" y1="18" x2="20" y2="18"/>
          <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      </button>
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('orderedList') }"
        @click="cmd(() => editor!.chain().focus().toggleOrderedList().run())" title="Ordered list">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>
          <line x1="10" y1="18" x2="21" y2="18"/>
          <path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="tb-divider" />
      <button type="button" class="tb-btn" :class="{ active: editor.isActive('blockquote') }"
        @click="cmd(() => editor!.chain().focus().toggleBlockquote().run())" title="Blockquote">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
        </svg>
      </button>
    </div>

    <!-- Editor area -->
    <EditorContent :editor="editor" class="editor-body" />
  </div>
</template>

<style scoped>
.rich-editor-wrap {
  border: 1px solid #1e2040;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #0e0e26;
}
.rich-editor-wrap:focus-within {
  border-color: #6366f1;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid #1e2040;
  background: #0b0b20;
  flex-wrap: wrap;
}
.tb-btn {
  display: flex; align-items: center; justify-content: center;
  min-width: 1.75rem; height: 1.75rem; padding: 0 0.25rem;
  border-radius: 0.3rem; border: none; background: transparent;
  color: #64748b; font-size: 0.8rem; cursor: pointer;
  transition: background 100ms, color 100ms;
}
.tb-btn:hover { background: #1a1a38; color: #c7d2fe; }
.tb-btn.active { background: #1e1b4b; color: #a5b4fc; }
.tb-divider {
  width: 1px; height: 1.125rem; background: #1e2040; margin: 0 0.25rem; flex-shrink: 0;
}
.editor-body {
  min-height: 8rem;
  padding: 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  line-height: 1.65;
  cursor: text;
}
.editor-body :deep(.tiptap) {
  outline: none;
  min-height: 7rem;
}
.editor-body :deep(h2) { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin: 0.75rem 0 0.25rem; }
.editor-body :deep(h3) { font-size: 0.95rem; font-weight: 600; color: #f1f5f9; margin: 0.6rem 0 0.2rem; }
.editor-body :deep(p) { margin: 0 0 0.5rem; }
.editor-body :deep(p:last-child) { margin-bottom: 0; }
.editor-body :deep(ul), .editor-body :deep(ol) { padding-left: 1.4rem; margin: 0.25rem 0 0.5rem; }
.editor-body :deep(li) { margin: 0.15rem 0; }
.editor-body :deep(blockquote) {
  border-left: 3px solid #4338ca; padding-left: 0.75rem;
  color: #94a3b8; margin: 0.5rem 0; font-style: italic;
}
.editor-body :deep(strong) { color: #f1f5f9; }
.editor-body :deep(em) { color: #c7d2fe; }
.editor-body :deep(p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: #334155; pointer-events: none; float: left; height: 0;
}
</style>

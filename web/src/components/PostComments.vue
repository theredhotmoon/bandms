<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  COMMENT_MAX, NAME_MAX, CommentApiError,
  asSession, clearFanSession, deleteComment, fetchComments, fetchFanProfile, formatCommentDate,
  postComment, readFanSession, saveDisplayName, storeFan,
  type FanProfile, type FanSession, type PostComment,
} from '@/lib/comments'
import { commentListLoader, withComment } from '@/lib/commentList'
import FanSignIn, { type FanSignInCopy } from './FanSignIn.vue'

/**
 * Comments under a news post. Everything here happens in the browser: the
 * page is static, so the list is fetched on mount and a new comment is
 * appended from the API's answer — no rebuild is involved at any point.
 *
 * Copy arrives as a prop (an island has no siteConfig); see postCommentsCopy()
 * in lib/copy.ts.
 */
export interface PostCommentsCopy {
  title: string
  empty: string
  signIn: FanSignInCopy
  nameLabel: string
  bodyLabel: string
  submit: string
  /** Takes {email}. */
  signedInAs: string
  signOut: string
  delete: string
  deleteConfirm: string
  blocked: string
  error: string
  changeName: string
  saveName: string
}

const props = defineProps<{
  postId: number
  lang: string
  /** This post's own path — where the sign-in link brings the fan back to. */
  returnPath: string
  copy: PostCommentsCopy
}>()

const comments = ref<PostComment[]>([])
const loaded = ref(false)
// The post was baked with comments on; the API has the last word, so a post
// switched off since the last build shows nothing rather than a dead form.
const enabled = ref(true)

const token = ref<string | null>(null)
const fan = ref<FanProfile | null>(null)
// The server render knows no session, so it would bake the sign-in form into
// the page and flash it at a signed-in fan until hydration. Nothing below the
// list renders until the browser has looked in its storage.
const ready = ref(false)

const body = ref('')
const displayName = ref('')
const posting = ref(false)
const editingName = ref(false)
const savingName = ref(false)

const error = ref('')
const armedDelete = ref<number | null>(null)
let disarm: ReturnType<typeof setTimeout> | undefined

const needsName = computed(() => !!fan.value && !fan.value.display_name)
// A function, not a string: `$&` or `$'` in an address would otherwise be read
// as a replacement pattern and garble the line.
const signedInAs = computed(() => props.copy.signedInAs.replace('{email}', () => fan.value?.email ?? ''))

// Whose unsent text is in the form. A session that lapsed keeps the text for
// its fan to come back to; nobody else may see it.
let draftOwner: number | null = null

/** Ends the session in this browser, leaving what the fan was writing. */
function endSession() {
  draftOwner = fan.value?.id ?? null
  clearFanSession()
  token.value = null
  fan.value = null
  error.value = ''
  disarmDelete()
  // A request of the ended session no longer speaks for these (see asSession).
  posting.value = false
  savingName.value = false
  // No session, no Delete: a button that silently does nothing is worse than none.
  comments.value = comments.value.map((c) => (c.mine ? { ...c, mine: false } : c))
}

function clearDrafts() {
  draftOwner = null
  body.value = ''
  displayName.value = ''
  editingName.value = false
}

function disarmDelete() {
  clearTimeout(disarm)
  armedDelete.value = null
}

const currentToken = () => token.value

/**
 * A 401 means the session lapsed: back to the sign-in form, without an error.
 * Reached through asSession() only, so it is always about the current session.
 */
function handle(e: unknown) {
  if (e instanceof CommentApiError && e.status === 401) {
    endSession()
    return
  }
  // A 403 here usually means the band blocked this fan since the page loaded;
  // ask again so the form gives way to the blocked notice.
  if (e instanceof CommentApiError && e.status === 403) void refreshProfile()
  // Only a 4xx the API worded for the fan is shown as written. A throttle or
  // a server error carries a framework string in English, whatever the page.
  // The band's own per-fan limit is the exception: a 429 the API marks with a code.
  const worded = e instanceof CommentApiError
    && ([403, 422].includes(e.status) || e.code === 'comment_limit') && e.message
  error.value = worded || props.copy.error
}

/**
 * The stored profile may predate display names or a block. The answer is
 * applied only if the fan is still signed in with the session that asked, and
 * never takes away a name set in the meantime (a first comment can beat it).
 */
async function refreshProfile() {
  const answer = await asSession(currentToken, (asked) => fetchFanProfile(props.lang, asked), (e) => {
    if (e instanceof CommentApiError && e.status === 401) endSession()
  })
  if (!answer) return
  const fresh = answer.value
  fan.value = { ...fresh, display_name: fresh.display_name ?? fan.value?.display_name ?? null }
  storeFan(fan.value)
}

const list = commentListLoader({
  token: currentToken,
  fetch: (asked) => fetchComments(props.postId, props.lang, asked),
  apply: (res) => {
    enabled.value = res.enabled
    comments.value = res.data
  },
  settled: () => { loaded.value = true },
})

onMounted(async () => {
  const session = readFanSession()
  if (session) {
    token.value = session.token
    fan.value = session.fan
    void refreshProfile()
  }
  ready.value = true
  await list.load()
})

/** Signed in under the post: the session is stored already; pick it up and re-read the list. */
async function onSignedIn(session: FanSession) {
  if (draftOwner !== session.fan.id) clearDrafts()
  token.value = session.token
  fan.value = session.fan
  error.value = ''
  void refreshProfile()
  // `mine` is decided by the token, so the fan's own comments get their Delete.
  await list.load()
}

async function submit() {
  if (posting.value || !token.value || !body.value.trim()) return
  const asker = token.value
  error.value = ''
  posting.value = true
  const answer = await asSession(currentToken, (asked) => postComment(props.postId, props.lang, asked, {
    body: body.value,
    ...(needsName.value ? { display_name: displayName.value } : {}),
  }), handle)
  if (token.value === asker) posting.value = false
  if (!answer) return
  const created = answer.value
  list.changed()
  comments.value = withComment(comments.value, created)
  if (fan.value && needsName.value) {
    fan.value = { ...fan.value, display_name: created.author_name }
    storeFan(fan.value)
  }
  body.value = ''
}

function startNameEdit() {
  displayName.value = fan.value?.display_name ?? ''
  editingName.value = true
}

async function saveName() {
  if (savingName.value || !token.value || !displayName.value.trim()) return
  const asker = token.value
  error.value = ''
  savingName.value = true
  const answer = await asSession(currentToken, (asked) => saveDisplayName(props.lang, asked, displayName.value), handle)
  if (token.value === asker) savingName.value = false
  if (!answer) return
  const fresh = answer.value
  fan.value = fresh
  storeFan(fresh)
  editingName.value = false
  // The new name shows on every comment the fan wrote.
  list.changed()
  comments.value = comments.value.map((c) => (c.mine ? { ...c, author_name: fresh.display_name ?? c.author_name } : c))
}

// Delete cannot be undone, so it takes a second click (no browser confirm).
async function remove(c: PostComment) {
  if (!token.value) return
  if (armedDelete.value !== c.id) {
    armedDelete.value = c.id
    clearTimeout(disarm)
    disarm = setTimeout(() => { armedDelete.value = null }, 3000)
    return
  }
  disarmDelete()
  error.value = ''
  const answer = await asSession(currentToken, (asked) => deleteComment(c.id, props.lang, asked), handle)
  if (!answer) return
  list.changed()
  comments.value = comments.value.filter((x) => x.id !== c.id)
}

function signOut() {
  const t = token.value
  endSession()
  clearDrafts()
  // Best effort: the session is gone from this browser either way.
  if (t) void fetch('/api/fan/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } }).catch(() => {})
}
</script>

<template>
  <section v-if="enabled" class="pc" data-testid="post-comments" :data-loaded="loaded">
    <h2 class="pc-title">
      {{ copy.title }}<span v-if="comments.length" class="pc-count" data-testid="comment-count"> ({{ comments.length }})</span>
    </h2>

    <ol v-if="comments.length" class="pc-list">
      <li v-for="c in comments" :key="c.id" class="pc-item" data-testid="comment-item">
        <div class="pc-meta">
          <span class="pc-author">{{ c.author_name }}</span>
          <time class="pc-date" :datetime="c.created_at">{{ formatCommentDate(c.created_at, lang) }}</time>
          <button v-if="c.mine" type="button" class="pc-link pc-delete" data-testid="comment-delete" @click="remove(c)">
            {{ armedDelete === c.id ? copy.deleteConfirm : copy.delete }}
          </button>
        </div>
        <p class="pc-body">{{ c.body }}</p>
      </li>
    </ol>
    <p v-else-if="loaded" class="pc-empty" data-testid="comments-empty">{{ copy.empty }}</p>

    <template v-if="ready">
    <!-- Signed out: password, new account, or an emailed link back to this post. -->
    <div v-if="!fan" class="pc-box" data-testid="comment-signin">
      <FanSignIn :copy="copy.signIn" :lang="lang" :return-path="returnPath" @signed-in="onSignedIn" />
    </div>

    <p v-else-if="fan.comments_blocked" class="pc-box pc-blocked" data-testid="comment-blocked">{{ copy.blocked }}</p>

    <div v-else class="pc-box">
      <form class="pc-form" data-testid="comment-form" @submit.prevent="submit">
        <template v-if="needsName">
          <label class="pc-label" for="pc-name">{{ copy.nameLabel }}</label>
          <input
            id="pc-name" v-model="displayName" type="text" required :maxlength="NAME_MAX"
            autocomplete="nickname" class="pc-input" data-testid="comment-name"
          />
        </template>
        <label class="pc-label" for="pc-body">{{ copy.bodyLabel }}</label>
        <textarea
          id="pc-body" v-model="body" required rows="4" :maxlength="COMMENT_MAX"
          class="pc-input pc-textarea" data-testid="comment-body"
        />
        <div class="pc-row pc-row--end">
          <span class="pc-counter" aria-hidden="true">{{ body.length }} / {{ COMMENT_MAX }}</span>
          <button type="submit" class="pc-btn" :disabled="posting" data-testid="comment-submit">{{ copy.submit }}</button>
        </div>
      </form>

      <form v-if="editingName" class="pc-form pc-nameform" @submit.prevent="saveName">
        <label class="pc-label" for="pc-rename">{{ copy.nameLabel }}</label>
        <div class="pc-row">
          <input id="pc-rename" v-model="displayName" type="text" required :maxlength="NAME_MAX" class="pc-input" data-testid="comment-rename" />
          <button type="submit" class="pc-btn" :disabled="savingName">{{ copy.saveName }}</button>
        </div>
      </form>

      <p class="pc-session">
        <span data-testid="comment-signed-in">{{ signedInAs }}</span>
        <button v-if="fan.display_name && !editingName" type="button" class="pc-link" data-testid="comment-change-name" @click="startNameEdit">{{ copy.changeName }}</button>
        <button type="button" class="pc-link" data-testid="comment-signout" @click="signOut">{{ copy.signOut }}</button>
      </p>
    </div>
    </template>

    <p v-if="error" class="pc-error" role="alert" data-testid="comment-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.pc { padding-block: 40px 8px; }

.pc-title {
  margin: 0 0 20px;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 28px;
  line-height: 1.1;
  letter-spacing: var(--display-tracking);
  text-transform: var(--display-transform);
  color: var(--color-body);
}
.pc-count { color: var(--color-muted); }

.pc-list { list-style: none; margin: 0 0 24px; padding: 0; }
.pc-item { padding: 16px 0; border-top: 1px solid var(--color-border); }
.pc-item:last-child { border-bottom: 1px solid var(--color-border); }

.pc-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-bottom: 6px; }
.pc-author { font: 700 16px/1.3 var(--font-body); color: var(--color-body); overflow-wrap: anywhere; }
.pc-date { font: 400 14px/1.3 var(--font-body); color: var(--color-muted); }
.pc-delete { margin-left: auto; }

.pc-body {
  margin: 0;
  font: 400 17px/1.55 var(--font-body);
  color: var(--color-body);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.pc-empty { margin: 0 0 24px; font: 400 17px/1.5 var(--font-body); color: var(--color-muted); }

.pc-box {
  border: var(--border-width-card) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  padding: 20px;
}
.pc-form { display: flex; flex-direction: column; gap: 8px; }
.pc-nameform { margin-top: 16px; }
.pc-label { font: 700 14px/1.3 var(--font-body); color: var(--color-body); }

.pc-input {
  width: 100%;
  box-sizing: border-box;
  border: var(--border-width-card) solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-2);
  padding: 12px 14px;
  font: 400 16px/1.4 var(--font-body);
  color: var(--color-body);
  outline: none;
}
.pc-input:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); }
.pc-textarea { resize: vertical; min-height: 110px; }

.pc-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.pc-row > .pc-input { flex: 1 1 220px; width: auto; }
.pc-row--end { justify-content: space-between; }
.pc-counter { font: 400 13px/1 var(--font-body); color: var(--color-muted); font-variant-numeric: tabular-nums; }

.pc-btn {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border: none;
  border-radius: var(--radius-card);
  font: 700 16px/1 var(--font-body);
  padding: 14px 20px;
  cursor: pointer;
}
.pc-btn:focus-visible { box-shadow: 0 0 0 3px var(--color-accent); outline: none; }
.pc-btn:disabled { opacity: .6; cursor: default; }

.pc-link {
  background: none;
  border: none;
  padding: 0;
  font: 400 14px/1.3 var(--font-body);
  color: var(--color-muted);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.pc-link:hover, .pc-link:focus-visible { color: var(--color-body); }

.pc-session {
  display: flex; flex-wrap: wrap; gap: 4px 14px;
  margin: 14px 0 0;
  font: 400 14px/1.3 var(--font-body);
  color: var(--color-muted);
  overflow-wrap: anywhere;
}
.pc-blocked { margin: 0; font: 400 16px/1.5 var(--font-body); color: var(--color-body); }
.pc-error { margin: 12px 0 0; font: 700 15px/1.4 var(--font-body); color: var(--color-danger); }
</style>

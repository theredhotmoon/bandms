// One-shot: StagePlotMemberSelector. Deleted after the commit.
import { readFileSync, writeFileSync } from 'node:fs'

const F = 'src/components/tech-rider/StagePlotMemberSelector.vue'
let src = readFileSync(F, 'utf8').split('\r\n').join('\n')
const L = 'rider.lineup'

const PAIRS = [
  [
    `      <h3 class="text-base font-semibold text-white">Who's playing at this gig?</h3>
      <p class="text-xs text-zinc-400 mt-0.5">Toggle members off if they won't be attending. Add replacement musicians as needed.</p>`,
    `      <h3 class="text-base font-semibold text-white">{{ $t('${L}.title') }}</h3>
      <p class="text-xs text-zinc-400 mt-0.5">{{ $t('${L}.hint') }}</p>`,
  ],
  [
    `      <p class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Band members</p>`,
    `      <p class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">{{ $t('${L}.bandMembers') }}</p>`,
  ],
  // Avatar colours, not copy.
  [
    `            :class="isAvailable(member.id) ? 'bg-zinc-600 text-white' : 'bg-zinc-700 text-zinc-400'"`,
    `            :class="avatarClass(member.id)"`,
  ],
  [
    `              {{ member.role ?? 'Musician' }}`,
    `              {{ member.role ?? $t('${L}.musician') }}`,
  ],
  [
    `      <p class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Temporary / Replacement musicians</p>`,
    `      <p class="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">{{ $t('${L}.temporary') }}</p>`,
  ],
  [
    `            <div class="text-xs text-amber-400/70">{{ temp.role || 'Replacement' }}</div>`,
    `            <div class="text-xs text-amber-400/70">{{ temp.role || $t('${L}.replacement') }}</div>`,
  ],
  [
    `          <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-800/50 text-amber-300 font-medium mr-1">GUEST</span>`,
    `          <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-800/50 text-amber-300 font-medium mr-1">{{ $t('${L}.guestBadge') }}</span>`,
  ],
  [`          placeholder="Full name"`, `          :placeholder="$t('${L}.fullName')"`],
  [`          placeholder="Role / Position (e.g. Guitar, Bass)"`, `          :placeholder="$t('${L}.rolePlaceholder')"`],
  [`          >Add musician</button>`, `          >{{ $t('${L}.addMusician') }}</button>`],
  [`          >Cancel</button>`, `          >{{ $t('common.actions.cancel') }}</button>`],
  [
    `        Add temporary musician
      </button>`,
    `        {{ $t('${L}.addTemporary') }}
      </button>`,
  ],
  // The count sits in its own styled span, so a plain {n} message cannot
  // carry the markup. <i18n-t> keeps one translatable sentence and lets the
  // slot supply the styled number — and :plural still selects the form.
  [
    `      <span class="text-sm text-zinc-400">
        <span class="font-medium text-white">{{ availableCount }}</span> musician{{ availableCount !== 1 ? 's' : '' }} in tonight's lineup
      </span>`,
    `      <i18n-t keypath="${L}.inLineup" tag="span" class="text-sm text-zinc-400" :plural="availableCount" scope="global">
        <template #n><span class="font-medium text-white">{{ availableCount }}</span></template>
      </i18n-t>`,
  ],
  [
    `        Done — place on stage →
      </button>`,
    `        {{ $t('${L}.donePlace') }}
      </button>`,
  ],
]

const problems = []
for (const [from, to] of PAIRS) {
  const n = src.split(from).length - 1
  if (n !== 1) { problems.push(`[${n}x] ${from.split('\n')[0].trim().slice(0, 62)}`); continue }
  src = src.replace(from, to)
}
if (problems.length) { for (const p of problems) console.error('  ' + p); process.exit(1) }

// The avatar helper, beside the other script state.
const anchor = src.match(/^const emit = defineEmits[^\n]*\n/m)
if (!anchor) { console.error('emit anchor'); process.exit(1) }
src = src.replace(
  anchor[0],
  anchor[0] +
    `\n/** Avatar colours — CSS classes, not copy. */\nconst avatarClass = (id: number) =>\n  isAvailable(id) ? 'bg-zinc-600 text-white' : 'bg-zinc-700 text-zinc-400' // i18n-ignore: CSS classes\n`,
)

writeFileSync(F, src)
console.log(`✓ StagePlotMemberSelector.vue — ${PAIRS.length}`)

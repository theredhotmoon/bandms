import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  createBandMember,
  deleteBandMember,
  fetchBandMembers,
  reorderBandMembers,
  updateBandMember,
  uploadMemberPhoto,
} from '@/api/bandMembers'
import type { BandMember, BandMemberPayload } from '@bandms/rider-core'
import { appendToList } from '@/utils/queryCache'
import { useAuth } from './useAuth'
import { useCreateWithUpload } from './useCreateWithUpload'

const MEMBERS_KEY = ['band-profile-members']

/** The create mutation on its own (no list observer); appends the row to the list cache. */
export function useCreateBandMember() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BandMemberPayload) => createBandMember(token.value!, payload),
    onSuccess: (member) => appendToList<BandMember>(queryClient, MEMBERS_KEY, member),
  })
}

/**
 * Create, then the photo the form carries in `photo_file` — the sequence the
 * Band Members page and the quick-add share (see useCreateWithUpload). The
 * page passes its own `create`.
 */
export function useCreateBandMemberWithPhoto(create = useCreateBandMember()) {
  const { token } = useAuth()
  const { t } = useI18n()
  const createWithPhoto = useCreateWithUpload<Omit<BandMemberPayload, 'photo_file'>, BandMember>({
    create: (payload) => create.mutateAsync(payload),
    upload: (member, file) => uploadMemberPhoto(token.value!, member.id, file),
    invalidateKey: MEMBERS_KEY,
    failureMessage: () => t('band.members.photoFailed'),
  })
  return (payload: BandMemberPayload): Promise<BandMember> => {
    const { photo_file: photoFile, ...rest } = payload
    return createWithPhoto(rest, photoFile ?? null)
  }
}

export function useBandMembers() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const qk = MEMBERS_KEY

  const query = useQuery<BandMember[]>({ queryKey: qk, queryFn: () => fetchBandMembers(token.value) })

  const create = useCreateBandMember()

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<BandMemberPayload> }) =>
      updateBandMember(token.value!, id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteBandMember(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const uploadPhoto = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      uploadMemberPhoto(token.value!, id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderBandMembers(token.value!, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  })

  return { query, create, update, remove, uploadPhoto, reorder }
}

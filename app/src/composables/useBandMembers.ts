import { useI18n } from 'vue-i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { reportSaveError } from '@/utils/formErrors'
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
import { createThenUpload } from '@/utils/createThenUpload'
import { useAuth } from './useAuth'

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
 * Create, then the photo the form may carry in `photo_file` — the sequence
 * the Band Members page uses, shared with the quick-add (see createThenUpload
 * for the policy). Pass the page's own `create` so its `isPending` covers
 * this path too.
 */
export function useCreateBandMemberWithPhoto(create = useCreateBandMember()) {
  const { token } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()

  return (payload: BandMemberPayload): Promise<BandMember> => {
    const { photo_file: photoFile, ...rest } = payload
    return createThenUpload(
      () => create.mutateAsync(rest),
      photoFile ? (async (member) => {
        await uploadMemberPhoto(token.value!, member.id, photoFile)
        void queryClient.invalidateQueries({ queryKey: MEMBERS_KEY })
      }) : null,
      (e) => reportSaveError(e, t('band.members.photoFailed')),
    )
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

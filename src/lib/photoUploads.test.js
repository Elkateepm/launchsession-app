import { supabase } from './supabase'
import { uploadChildPhoto } from './childPhoto'
import { uploadStaffPhoto } from './staffPhoto'
import { storagePath, signOne, clearSignedUrlCache } from './storageUrl'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() }, auth: { onAuthStateChange: jest.fn() } } }))
jest.mock('./shrinkImage', () => ({ shrinkImage: async file => file, __esModule: true, default: async file => file }))

let bucket, rowUpdate
beforeEach(() => {
  clearSignedUrlCache()
  bucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    remove: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest.fn(async path => ({ data: { signedUrl: `https://signed/${path}?token=${Math.random()}` }, error: null })),
  }
  supabase.storage.from.mockReturnValue(bucket)
  rowUpdate = { eq: jest.fn(() => rowUpdate), then: (res, rej) => Promise.resolve({ error: null }).then(res, rej) }
  supabase.from.mockReturnValue({ update: jest.fn(() => rowUpdate) })
})

const jpg = (name = 'photo.jpg') => new File(['x'], name, { type: 'image/jpeg' })

describe('a child photo', () => {
  test('goes under the organisation folder with a new name each time, scoped to that org', async () => {
    const path = await uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: jpg() })
    expect(path).toMatch(/^org1\/children\/c1\/photo-\d+\.jpg$/)
    expect(supabase.storage.from).toHaveBeenCalledWith('gallery')
    expect(bucket.upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: 'image/jpeg' })
    expect(supabase.from).toHaveBeenCalledWith('children')
    expect(rowUpdate.eq).toHaveBeenCalledWith('id', 'c1')
    expect(rowUpdate.eq).toHaveBeenCalledWith('org_id', 'org1')
  })

  test('replacing removes the old file, but never one outside this child\'s folder', async () => {
    await uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: jpg(), previous: 'org1/children/c1/photo.jpg' })
    expect(bucket.remove).toHaveBeenCalledWith(['org1/children/c1/photo.jpg'])
    bucket.remove.mockClear()
    await uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: jpg(), previous: 'org2/children/c9/photo.jpg' })
    expect(bucket.remove).not.toHaveBeenCalled()
  })

  test('failures are explained, and a photo that could not be saved is not left behind', async () => {
    await expect(uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: new File(['x'], 'notes.pdf', { type: 'application/pdf' }) })).rejects.toThrow(/not an image/)
    await expect(uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: new File(['x'], 'a.heic', { type: 'image/heic' }) })).rejects.toThrow(/HEIC/)
    bucket.upload.mockResolvedValueOnce({ error: { message: 'denied' } })
    await expect(uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: jpg() })).rejects.toThrow(/could not be uploaded/)
    rowUpdate.then = (res, rej) => Promise.resolve({ error: { message: 'rls' } }).then(res, rej)
    await expect(uploadChildPhoto({ orgId: 'org1', childId: 'c1', file: jpg() })).rejects.toThrow(/could not be saved/)
    expect(bucket.remove).toHaveBeenCalledWith([expect.stringMatching(/^org1\/children\/c1\/photo-\d+\.jpg$/)])
  })
})

describe('your own photo', () => {
  test('keeps the name the storage policy requires and returns a versioned reference', async () => {
    const stored = await uploadStaffPhoto({ userId: 'u1', file: jpg('me.JPG') })
    expect(bucket.upload).toHaveBeenCalledWith('u1.jpg', expect.any(File), { upsert: true, contentType: 'image/jpeg' })
    expect(stored).toMatch(/^u1\.jpg\?v=\d+$/)
    expect(storagePath('staff-photos', stored)).toBe('u1.jpg')
  })

  test('a photo in a new format removes the old file, and only ever your own', async () => {
    await uploadStaffPhoto({ userId: 'u1', file: jpg(), previous: 'u1.png?v=1' })
    expect(bucket.remove).toHaveBeenCalledWith(['u1.png'])
    bucket.remove.mockClear()
    await uploadStaffPhoto({ userId: 'u1', file: jpg(), previous: 'u2.png' })
    expect(bucket.remove).not.toHaveBeenCalled()
  })
})

test('a new version of the same path is signed afresh; the same version reuses its URL', async () => {
  const first = await signOne('staff-photos', 'u1.jpg?v=1')
  expect(await signOne('staff-photos', 'u1.jpg?v=1')).toBe(first)
  const second = await signOne('staff-photos', 'u1.jpg?v=2')
  expect(second).not.toBe(first)
  expect(bucket.createSignedUrl).toHaveBeenCalledWith('u1.jpg', expect.any(Number))
  expect(bucket.createSignedUrl).toHaveBeenCalledTimes(2)
})

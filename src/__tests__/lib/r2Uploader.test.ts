// Mock logger first to avoid import.meta access in tests
jest.mock('../../lib/logger', () => ({
  __esModule: true,
  getLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}))

import { uploadPropertyImages } from '../../lib/upload/r2Uploader'
import * as fileValidation from '../../lib/fileValidation'
import * as imageCompression from '../../lib/imageCompression'

// Minimal SupabaseClient mock shape we rely on
const supabase = {
  functions: {
    invoke: jest.fn(),
  },
  auth: {
    getSession: jest.fn(),
  },
} as any

// Helpers to create a fake File in JSDOM
function makeFile(name: string, type = 'image/jpeg', size = 1234): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('uploadPropertyImages', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'test_jwt' } } })
    jest.spyOn(fileValidation, 'validateImagesBatch').mockResolvedValue({ ok: true, reasons: [] } as any)
    jest.spyOn(imageCompression, 'compressImagesBatch').mockImplementation(async (files: File[]) => files)
  })

  afterEach(() => {
    global.fetch = originalFetch as any
  })

  test('happy path: returns public URLs', async () => {
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]

    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {
        uploads: [
          { key: 'k1', putUrl: 'https://r2/put1', contentType: 'image/jpeg', publicUrl: 'https://cdn/u1.jpg' },
          { key: 'k2', putUrl: 'https://r2/put2', contentType: 'image/jpeg', publicUrl: 'https://cdn/u2.jpg' },
        ],
      },
      error: null,
    })

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const urls = await uploadPropertyImages(supabase, 'prop_1', files)
    expect(urls).toEqual(['https://cdn/u1.jpg', 'https://cdn/u2.jpg'])

    expect(supabase.functions.invoke).toHaveBeenCalledWith('r2-presign', expect.objectContaining({
      body: expect.objectContaining({ propertyId: 'prop_1' }),
    }))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  test('presign error bubbles with status when available', async () => {
    const files = [makeFile('a.jpg')]
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Forbidden' },
    })

    await expect(uploadPropertyImages(supabase, 'prop_1', files)).rejects.toThrow(/Failed to prepare uploads.*403/)
  })

  test('upload preparation mismatch throws', async () => {
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { uploads: [{ key: 'k1', putUrl: 'https://r2/put1', contentType: 'image/jpeg', publicUrl: 'https://cdn/u1.jpg' }] },
      error: null,
    })

    await expect(uploadPropertyImages(supabase, 'prop_1', files)).rejects.toThrow(/Upload preparation mismatch/)
  })

  test('PUT failure throws with status', async () => {
    const files = [makeFile('a.jpg')]
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { uploads: [{ key: 'k1', putUrl: 'https://r2/put1', contentType: 'image/jpeg', publicUrl: 'https://cdn/u1.jpg' }] },
      error: null,
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(uploadPropertyImages(supabase, 'prop_1', files)).rejects.toThrow(/Failed to upload image.*500/)
  })

  test('missing publicUrl throws helpful error', async () => {
    const files = [makeFile('a.jpg')]
    ;(supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { uploads: [{ key: 'k1', putUrl: 'https://r2/put1', contentType: 'image/jpeg' }] },
      error: null,
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 })

    await expect(uploadPropertyImages(supabase, 'prop_1', files)).rejects.toThrow(/Upload succeeded but URL generation failed/)
  })
})

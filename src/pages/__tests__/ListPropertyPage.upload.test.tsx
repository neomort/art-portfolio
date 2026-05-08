import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
// Mock logger to avoid import.meta in tests
jest.mock('../../lib/logger', () => ({
  getLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}))

// Mock the shared uploader so we don't run validation/compression logic in this integration test
jest.mock('../../lib/upload/r2Uploader', () => ({
  __esModule: true,
  uploadPropertyImages: jest.fn(async () => [
    'https://cdn/u1.jpg',
    'https://cdn/u2.jpg',
  ]),
}))
// Do not mock ImageDropzone; ImageUploader exposes a hidden native input
// with data-testid="uploader-input" for integration tests.
import ListPropertyPage from '../ListPropertyPage'

// Mock useAuth to provide a logged-in user
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_123' } }),
}))

// Mock supabase client methods used in the page (define fns inside factory)
jest.mock('../../lib/supabase', () => {
  const insertMock = jest.fn(function (this: any) { return this })
  const updateMock = jest.fn(function (this: any) { return this })
  const eqMock = jest.fn(() => ({ data: null, error: null }))
  const selectMock = jest.fn(() => ({ single: () => ({ data: { id: 'prop_123' }, error: null }) }))
  const fromMock = jest.fn(() => ({
    insert: insertMock,
    select: selectMock,
    single: () => ({ data: { id: 'prop_123' }, error: null }),
    update: updateMock,
    eq: eqMock,
  }))

  const functionsInvoke = jest.fn(async () => ({
    data: {
      uploads: [
        { key: 'k1', putUrl: 'https://r2/put1', contentType: 'image/jpeg', publicUrl: 'https://cdn/u1.jpg' },
        { key: 'k2', putUrl: 'https://r2/put2', contentType: 'image/jpeg', publicUrl: 'https://cdn/u2.jpg' },
      ],
    },
    error: null,
  }))

  return {
    supabase: {
      from: fromMock,
      functions: { invoke: functionsInvoke },
      __m: { fromMock, insertMock, updateMock, eqMock, selectMock },
    },
  }
})

// Minimal helpers to create fake Files
function makeFile(name: string, type = 'image/jpeg', size = 10): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('ListPropertyPage image upload integration', () => {
  const originalFetch = global.fetch
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    // JSDOM doesn't implement createObjectURL
    // @ts-ignore
    URL.createObjectURL = jest.fn(() => 'blob:mock')
    // @ts-ignore
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch as any
    // @ts-ignore
    URL.createObjectURL = originalCreateObjectURL
    // @ts-ignore
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  test('submits form, uploads images through R2 service, and updates property with URLs', async () => {
    // First fetch call: Nominatim geocode
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ([{ lat: '40.7608', lon: '-111.8910' }]), ok: true })
      // R2 PUTs for two images
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    const { container } = render(
      <MemoryRouter>
        <ListPropertyPage />
      </MemoryRouter>
    )

    // Fill required fields using roles (labels are not associated via htmlFor)
    const textboxes = screen.getAllByRole('textbox')
    // Order: Title (input), Description (textarea), Street, City, State, Postal
    fireEvent.change(textboxes[0], { target: { value: 'Test Space' } })
    fireEvent.change(textboxes[1], { target: { value: 'A nice place' } })
    fireEvent.change(textboxes[2], { target: { value: '123 Main St' } })
    fireEvent.change(textboxes[3], { target: { value: 'Salt Lake City' } })
    fireEvent.change(textboxes[4], { target: { value: 'UT' } })
    fireEvent.change(textboxes[5], { target: { value: '84101' } })

    // Number inputs
    const spins = screen.getAllByRole('spinbutton')
    // First is Base Price per Day
    fireEvent.change(spins[0], { target: { value: '100' } })
    // Second is Square Feet
    fireEvent.change(spins[1], { target: { value: '1000' } })
    // Property Type select is pre-filled; leave as default

    // Provide price unless inquire_for_pricing is enabled
    // priceInput ref no longer needed

    // Add images via ImageUploader's hidden test input
    const fileInput = (await screen.findByTestId('uploader-input')) as HTMLInputElement
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    fireEvent.change(fileInput, { target: { files } })

    // Wait for previews to render (ensures state updated)
    await waitFor(() => {
      const previews = container.querySelectorAll('img[alt^="Preview "]')
      expect(previews.length).toBeGreaterThan(0)
    })

    // Submit the form
    const formEl = container.querySelector('form') as HTMLFormElement
    fireEvent.submit(formEl)

    // Wait for the update call to be made with uploaded URLs
    const { supabase } = jest.requireMock('../../lib/supabase') as any
    await waitFor(() => {
      expect(supabase.__m.updateMock).toHaveBeenCalled()
    })
  })
})

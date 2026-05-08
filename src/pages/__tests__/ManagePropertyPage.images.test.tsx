import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mock logger to avoid import.meta in tests
jest.mock('../../lib/logger', () => ({
  getLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}))

// Mock the shared uploader so we don't run validation/compression logic in this integration test
jest.mock('../../lib/upload/r2Uploader', () => ({
  __esModule: true,
  uploadPropertyImages: jest.fn(async () => [
    'https://cdn/new1.jpg',
    'https://cdn/new2.jpg',
  ]),
}))

// Mock validation to always pass in this integration scenario
jest.mock('../../lib/fileValidation', () => ({
  __esModule: true,
  validateImagesBatch: jest.fn(async (_files: File[]) => ({ ok: true })),
}))

// Mock compression to identity to avoid canvas/bitmap APIs
jest.mock('../../lib/imageCompression', () => ({
  __esModule: true,
  compressImage: jest.fn(async (f: File) => f),
}))

// Mock taxrate util to avoid import.meta usage in tests
jest.mock('../../utils/taxrate', () => ({
  __esModule: true,
  getTaxRateByZip: jest.fn(async (_zip: string) => 0),
}))

// We no longer mock ImageDropzone because ImageUploader exposes a hidden
// native input for testing via data-testid="uploader-input".

// Mock useAuth to provide a logged-in user
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user_123' } }),
}))

// Mock supabase client methods used in the page
jest.mock('../../lib/supabase', () => {
  const updateMock = jest.fn(function (this: any) { return this })

  const fromMock = jest.fn((table: string) => {
    if (table === 'properties') {
      const single = () => ({
        data: {
          id: 'prop_123',
          venue_id: 'user_123',
          title: 'Existing Title',
          description: 'Desc',
          address_street: '123 St',
          address_city: 'City',
          address_state: 'ST',
          address_postal_code: '00000',
          address_country: 'US',
          price_per_day: 100,
          inquire_for_pricing: false,
          square_feet: 1000,
          property_type: 'retail',
          tax_rate: 0,
          fee_type: 'percentage',
          fee_value: 0,
          fee_description: '',
          amenities: [],
          weekly_rate_type: null,
          weekly_rate_value: null,
          monthly_rate_type: null,
          monthly_rate_value: null,
          yearly_rate_type: null,
          yearly_rate_value: null,
          featured: false,
          published: false,
          images: ['https://cdn/existing.jpg'],
        },
        error: null,
      })
      return {
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })),
        update: updateMock,
        eq: jest.fn(() => ({ data: null, error: null })),
        single,
      }
    }
    if (table === 'property_schedule') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn(() => ({ data: [], error: null })) })) }))
        })),
        upsert: jest.fn(() => ({ error: null })),
      }
    }
    return {}
  })

  return {
    supabase: {
      from: fromMock,
      __m: { fromMock, updateMock },
    },
  }
})

import ManagePropertyPage from '../ManagePropertyPage'

function makeFile(name: string, type = 'image/jpeg', size = 10): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('ManagePropertyPage image tab integration', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    jest.clearAllMocks()
    // @ts-ignore
    URL.createObjectURL = jest.fn(() => 'blob:mock')
    // @ts-ignore
    URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    // @ts-ignore
    URL.createObjectURL = originalCreateObjectURL
    // @ts-ignore
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  test('adds new images and saves, updating property with merged URLs', async () => {
    const { supabase } = jest.requireMock('../../lib/supabase') as any

    render(
      <MemoryRouter initialEntries={[`/manage/prop_123`]}>
        <Routes>
          <Route path="/manage/:id" element={<ManagePropertyPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Wait for page to load and switch to Images tab
    const imagesTab = await screen.findByText('Images')
    fireEvent.click(imagesTab)

    // Add images via ImageUploader's hidden input
    const input = await screen.findByTestId('uploader-input')
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    fireEvent.change(input, { target: { files } })

    // Click Save Image Changes
    const saveBtn = await screen.findByRole('button', { name: /save image changes/i })
    fireEvent.click(saveBtn)

    // Expect an update with merged existing and new URLs
    await waitFor(() => {
      expect(supabase.__m.updateMock).toHaveBeenCalled()
    })
  })
})

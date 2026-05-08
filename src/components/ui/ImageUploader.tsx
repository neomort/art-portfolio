import React from 'react'
import ImageDropzone from './ImageDropzone'

export type ImageUploaderProps = {
  onFilesSelected: (files: File[]) => void
  label?: string
  description?: string
  accept?: string[]
  maxCount?: number
  className?: string
  // When true, also render a hidden file input that can be used in tests
  exposeTestInput?: boolean
}

/**
 * ImageUploader
 * A thin, reusable wrapper around ImageDropzone that provides consistent
 * label/description UI and an optional hidden <input type="file" /> hook
 * to make integration testing straightforward without mocking react-dropzone.
 */
export default function ImageUploader({
  onFilesSelected,
  label = 'Upload images',
  description,
  accept,
  maxCount,
  className,
  exposeTestInput = true,
}: ImageUploaderProps) {
  const handleNativeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onFilesSelected(files)
  }

  return (
    <div className={className}>
      <div className="mb-2">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description ? (
          <div className="text-xs text-gray-600 mt-1">{description}</div>
        ) : null}
      </div>

      <ImageDropzone
        onFilesSelected={onFilesSelected}
        accept={accept}
        maxCount={maxCount}
        className="border border-dashed border-gray-300 rounded-md p-4 bg-white"
      />

      {exposeTestInput && (
        <input
          type="file"
          multiple
          data-testid="uploader-input"
          style={{ display: 'none' }}
          onChange={handleNativeInputChange}
          // Note: accept mapping for native input is best-effort
          accept={accept && accept.length ? accept.join(',') : undefined}
        />
      )}
    </div>
  )
}

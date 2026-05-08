import React, { useState, useRef } from 'react';
import { X, Upload, Copy, Check, Image, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<string>;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const url = await onUpload(selectedFile);
      setUploadedUrl(url);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyUrl = () => {
    if (uploadedUrl) {
      navigator.clipboard.writeText(uploadedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyMarkdown = () => {
    if (uploadedUrl) {
      const markdown = `![${selectedFile?.name || 'Image'}](${uploadedUrl})`;
      navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setUploadedUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-maroon-800">Upload Image</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!uploadedUrl ? (
          <>
            {!selectedFile ? (
              <div className="border-2 border-dashed border-maroon-200 rounded-xl p-8 text-center">
                <Image className="h-12 w-12 mx-auto text-maroon-400 mb-4" />
                <p className="text-maroon-600 mb-4">
                  Drag and drop an image here, or click to select a file
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  Select Image
                </Button>
                <p className="text-xs text-maroon-500 mt-4">
                  Maximum file size: 10MB
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border border-maroon-200 rounded-xl p-2 bg-maroon-50">
                  {preview && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-2">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-maroon-600 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-maroon-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={handleUpload}
                    isLoading={uploading}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={uploading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="border border-green-200 rounded-xl p-4 bg-green-50">
              <div className="flex items-center text-green-700 mb-2">
                <Check className="h-5 w-5 mr-2" />
                <p className="font-medium">Image uploaded successfully!</p>
              </div>
              
              {preview && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-4">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-maroon-700">Image URL:</p>
                <div className="flex">
                  <input
                    type="text"
                    value={uploadedUrl}
                    readOnly
                    className="flex-1 rounded-l-xl border-2 border-r-0 border-maroon-200 p-2 text-sm bg-white"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="bg-maroon-600 text-white px-3 rounded-r-xl hover:bg-maroon-700 transition-colors"
                    title="Copy URL"
                  >
                    {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-maroon-700">Markdown Code:</p>
              <div className="flex">
                <input
                  type="text"
                  value={`![${selectedFile?.name || 'Image'}](${uploadedUrl})`}
                  readOnly
                  className="flex-1 rounded-l-xl border-2 border-r-0 border-maroon-200 p-2 text-sm bg-white"
                />
                <button
                  onClick={handleCopyMarkdown}
                  className="bg-maroon-600 text-white px-3 rounded-r-xl hover:bg-maroon-700 transition-colors"
                  title="Copy Markdown"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-maroon-500">
                Copy this code and paste it into your content to insert the image
              </p>
            </div>

            <div className="flex space-x-2 pt-2">
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                Upload Another Image
              </Button>
              <Button
                onClick={onClose}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadModal;
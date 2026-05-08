import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon } from 'lucide-react';

interface FileWithPreview extends File {
  preview?: string;
}

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxSize?: number; // Maximum file size in bytes
  maxFiles?: number; // Maximum number of files
  existingPreviews?: string[]; // URLs for existing images
  className?: string;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  onFilesSelected,
  maxSize = 10485760, // 10MB default
  maxFiles = 10,
  existingPreviews: _existingPreviews = [],
  className = '',
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const sizeError = rejectedFiles.some(file => file.errors.some((err: any) => err.code === 'file-too-large'));
      const typeError = rejectedFiles.some(file => file.errors.some((err: any) => err.code === 'file-invalid-type'));
      
      if (sizeError) {
        setError(`Some files were rejected because they exceed the ${maxSize / 1024 / 1024}MB size limit`);
      } else if (typeError) {
        setError('Only image files are allowed');
      } else {
        setError('Some files were rejected');
      }
    } else {
      setError(null);
    }

    // Check if adding these files would exceed the maxFiles limit
    if (files.length + acceptedFiles.length > maxFiles) {
      setError(`You can only upload a maximum of ${maxFiles} files`);
      // Only add files up to the limit
      const availableSlots = maxFiles - files.length;
      if (availableSlots <= 0) return;
      
      acceptedFiles = acceptedFiles.slice(0, availableSlots);
    }
    
    const filesWithPreview = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    
    setFiles(prevFiles => [...prevFiles, ...filesWithPreview]);
    onFilesSelected(acceptedFiles);
  }, [files, maxFiles, maxSize, onFilesSelected]);

  // Handle paste events to capture clipboard images
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      
      const items = event.clipboardData.items;
      const imageFiles: File[] = [];
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            // Check file size
            if (file.size > maxSize) {
              setError(`Image exceeds the ${maxSize / 1024 / 1024}MB size limit`);
              continue;
            }
            imageFiles.push(file);
          }
        }
      }
      
      if (imageFiles.length > 0) {
        // Check if adding these files would exceed the maxFiles limit
        if (files.length + imageFiles.length > maxFiles) {
          setError(`You can only upload a maximum of ${maxFiles} files`);
          // Only add files up to the limit
          const availableSlots = maxFiles - files.length;
          if (availableSlots <= 0) return;
          
          imageFiles.splice(availableSlots);
        }
        
        const filesWithPreview = imageFiles.map(file => 
          Object.assign(file, {
            preview: URL.createObjectURL(file)
          })
        );
        
        setFiles(prevFiles => [...prevFiles, ...filesWithPreview]);
        onFilesSelected(imageFiles);
        
        // Show success message
        setError(null);
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [files, maxFiles, maxSize, onFilesSelected]);
  
  // Clean up previews
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    },
    maxSize,
    multiple: true,
    maxFiles
  });

  // no removeFile UI currently; if added later, ensure to revoke object URLs

  return (
    <div className={className}>
      <div 
        {...getRootProps()} 
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ${
          isDragActive 
            ? 'border-maroon-500 bg-maroon-50' 
            : 'border-maroon-200 hover:border-maroon-300'
        }`}
      >
        <div className="space-y-1 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-maroon-400" />
          <div className="flex flex-col text-sm text-maroon-600">
            <span className="font-medium text-maroon-700 hover:text-maroon-500">
              {isDragActive ? 'Drop images here...' : 'Drop images here or click to upload'}
            </span>
            <p className="text-xs text-maroon-500 mt-1">
              PNG, JPG, GIF up to {maxSize / 1024 / 1024}MB
            </p>
            <p className="text-xs text-maroon-500 mt-1">
              You can also paste images from clipboard (Ctrl+V / Cmd+V)
            </p>
          </div>
          <input {...getInputProps()} />
        </div>
      </div>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageDropzone;

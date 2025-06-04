"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload } from "lucide-react"

interface ImageUploaderProps {
  onImageUpload: (file: File) => void
  isLoading: boolean
}

export function ImageUploader({ onImageUpload, isLoading }: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith("image/")) {
        onImageUpload(file)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type.startsWith("image/")) {
        onImageUpload(file)
      }
    }
  }

  const openFileSelector = () => {
    inputRef.current?.click()
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={openFileSelector}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
      />

      <div className="text-center">
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600">
          {isLoading ? "Processing..." : "Click to upload or drag and drop an image"}
        </p>
        <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</p>
      </div>
    </div>
  )
}

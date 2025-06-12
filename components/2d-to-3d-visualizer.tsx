"use client"

import { useState } from "react"
import { Eye } from "lucide-react"
import { ImageUploader } from "./image-uploader"
import { Visualizer3D } from "./visualizer-3d"

interface ThreeJSData {
  vertices: number[]
  colors: number[]
  metadata: {
    version: number
    type: string
    points: number
    width: number
    height: number
  }
}

interface APIResponse {
  success: boolean
  data: {
    threejs_data: ThreeJSData
    depth_image_base64?: string
    original_image_base64?: string
  }
  message?: string
  error?: string
}

// Helper function to emit system status updates
const updateSystemStatus = (updates: any) => {
  const event = new CustomEvent("systemStatusUpdate", { detail: updates })
  window.dispatchEvent(event)
}

// Make sure to include https:// in the URL
const API_BASE_URL = "https://vis3d.fly.dev"

export function TwoDToThreeDVisualizer() {
  const [isLoading, setIsLoading] = useState(false)
  const [threejsData, setThreejsData] = useState<ThreeJSData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [apiResponse, setApiResponse] = useState<string>("")

  const handleImageUpload = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setUploadedImage(file)
    setApiResponse("")

    // Update system status to show conversion is active
    updateSystemStatus({ imageConversion: true })

    try {
      // Create form data with the file
      const formData = new FormData()
      formData.append("file", file)

      console.log("Sending request to API with file:", file.name, file.type, file.size)
      console.log("API URL:", `${API_BASE_URL}/api/v1/convert`)

      const response = await fetch(`${API_BASE_URL}/api/v1/convert`, {
        method: "POST",
        body: formData,
      })

      console.log("API response status:", response.status)
      console.log("API response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`
        try {
          const errorText = await response.text()
          console.log("Error response body:", errorText.substring(0, 500))

          // Check if the response is HTML (likely an error page)
          if (errorText.trim().startsWith("<!DOCTYPE") || errorText.trim().startsWith("<html")) {
            errorDetail += " - API returned HTML instead of JSON. Check the API URL and CORS settings."
          } else {
            errorDetail += ` - ${errorText}`
          }
        } catch (e) {
          errorDetail += ` - ${response.statusText}`
        }
        throw new Error(errorDetail)
      }

      const responseText = await response.text()
      console.log("Raw API response first 100 chars:", responseText.substring(0, 100))

      // Check if the response is HTML
      if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
        throw new Error("API returned HTML instead of JSON. Check the API URL and CORS settings.")
      }

      let data: APIResponse
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse JSON response:", parseError)
        setApiResponse(responseText.substring(0, 1000))
        throw new Error(`Invalid JSON response from API: ${parseError.message}`)
      }

      console.log("Parsed API response structure:", {
        success: data.success,
        hasData: !!data.data,
        hasThreejsData: !!data.data?.threejs_data,
        dataKeys: data.data ? Object.keys(data.data) : [],
      })

      // Store response for debugging
      setApiResponse(JSON.stringify(data, null, 2).substring(0, 1000) + "...")

      // Check if the API call was successful
      if (!data.success) {
        throw new Error(data.message || data.error || "API returned success: false")
      }

      // Extract the 3D data from the correct nested structure
      if (data.data && data.data.threejs_data) {
        const threejsData = data.data.threejs_data

        // Validate the 3D data structure
        if (!threejsData.vertices || !threejsData.colors) {
          throw new Error("Invalid 3D data: missing vertices or colors")
        }

        if (!Array.isArray(threejsData.vertices) || !Array.isArray(threejsData.colors)) {
          throw new Error("Invalid 3D data: vertices and colors must be arrays")
        }

        if (threejsData.vertices.length === 0 || threejsData.colors.length === 0) {
          throw new Error("Invalid 3D data: empty vertices or colors arrays")
        }

        // Ensure we have the correct ratio of vertices to colors (3:3 ratio)
        const expectedColorLength = threejsData.vertices.length
        if (threejsData.colors.length !== expectedColorLength) {
          console.warn(
            `Color array length (${threejsData.colors.length}) doesn't match vertex array length (${threejsData.vertices.length})`,
          )
        }

        console.log("3D data extracted successfully:", {
          vertices: threejsData.vertices.length,
          colors: threejsData.colors.length,
          points: threejsData.metadata?.points || threejsData.vertices.length / 3,
          metadata: threejsData.metadata,
        })

        setThreejsData(threejsData)
      } else {
        console.log("API response structure:", data)
        throw new Error("No 3D data found in API response")
      }
    } catch (err) {
      console.error("Conversion error:", err)
      setError(err instanceof Error ? err.message : "Failed to convert image to 3D")
    } finally {
      setIsLoading(false)
      // Update system status to show conversion is complete
      updateSystemStatus({ imageConversion: false })
    }
  }

  const startVisualization = () => {
    if (uploadedImage) {
      handleImageUpload(uploadedImage)
    }
  }

  return (
    <div className="space-y-4">
      <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />

      {uploadedImage && !isLoading && !threejsData && (
        <button
          onClick={startVisualization}
          className="w-full bg-[#0f172a] text-white py-3 rounded flex items-center justify-center gap-2"
        >
          <Eye className="h-5 w-5" />
          Start Visualizer
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-600 text-sm font-medium">Error:</p>
          <p className="text-red-600 text-sm">{error}</p>
          {apiResponse && (
            <details className="mt-2">
              <summary className="text-red-500 text-xs cursor-pointer">Show API Response</summary>
              <pre className="text-xs bg-red-100 p-2 mt-1 rounded overflow-auto max-h-40">{apiResponse}</pre>
            </details>
          )}
        </div>
      )}

      <Visualizer3D threejsData={threejsData} isLoading={isLoading} />

      {threejsData && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-green-600 text-sm">
            ✅ 3D conversion complete! {threejsData.metadata?.points || Math.floor(threejsData.vertices.length / 3)}{" "}
            points generated
          </p>
          <p className="text-green-500 text-xs mt-1">
            Vertices: {threejsData.vertices.length}, Colors: {threejsData.colors.length}
          </p>
          {threejsData.metadata && (
            <p className="text-green-500 text-xs">
              Dimensions: {threejsData.metadata.width}x{threejsData.metadata.height}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

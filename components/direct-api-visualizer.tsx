"use client"

import { useState, useEffect } from "react"
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

// Sample data for testing when API is unavailable
const SAMPLE_DATA: ThreeJSData = {
  vertices: [
    // Create a simple cube for demonstration
    -1,
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    1,
    -1,
    -1,
    1,
    -1,
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1,
    1,
    // Add more points to make it look like a point cloud
    ...Array.from({ length: 500 }, () => [
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
    ]).flat(),
  ],
  colors: [
    // Colors for the cube vertices
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    1,
    1,
    0,
    1,
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    0.5,
    0.5,
    0.5,
    // Random colors for the point cloud
    ...Array.from({ length: 500 }, () => [Math.random(), Math.random(), Math.random()]).flat(),
  ],
  metadata: {
    version: 1.0,
    type: "points",
    points: 508, // 8 cube vertices + 500 random points
    width: 640,
    height: 480,
  },
}

// Make sure to include https:// in the URL
const API_BASE_URL = "https://vis3d-production.up.railway.app"

export function DirectApiVisualizer() {
  const [isLoading, setIsLoading] = useState(true)
  const [threejsData, setThreejsData] = useState<ThreeJSData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Try to fetch a sample 3D model directly from the API
    const fetchSampleData = async () => {
      try {
        // First try to use the sample data to ensure visualization works
        setThreejsData(SAMPLE_DATA)
        setIsLoading(false)

        // Then try to fetch from API in the background
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/sample`, {
            method: "GET",
          })

          if (response.ok) {
            const data = await response.json()
            if (data.threejs_data) {
              setThreejsData(data.threejs_data)
            }
          }
        } catch (apiError) {
          // Silently fail - we already have sample data showing
          console.log("Could not fetch from API, using sample data instead")
        }
      } catch (err) {
        setError("Failed to initialize 3D viewer")
        setIsLoading(false)
      }
    }

    fetchSampleData()
  }, [])

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <Visualizer3D threejsData={threejsData} isLoading={isLoading} />

      {threejsData && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-blue-600 text-sm">3D visualization active - {threejsData.metadata.points} points</p>
          <p className="text-blue-500 text-xs mt-1">Upload an image to generate your own 3D model</p>
        </div>
      )}
    </div>
  )
}

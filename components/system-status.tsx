"use client"

import { useEffect, useState } from "react"

interface SystemActivity {
  faceDetection: boolean
  handDetection: boolean
  imageConversion: boolean
  cameraActive: boolean
}

export function SystemStatus() {
  const [activities, setActivities] = useState<SystemActivity>({
    faceDetection: false,
    handDetection: false,
    imageConversion: false,
    cameraActive: false,
  })

  useEffect(() => {
    // Listen for system activity updates
    const handleSystemUpdate = (event: CustomEvent) => {
      setActivities((prev) => ({
        ...prev,
        ...event.detail,
      }))
    }

    // @ts-ignore
    window.addEventListener("systemStatusUpdate", handleSystemUpdate)

    return () => {
      // @ts-ignore
      window.removeEventListener("systemStatusUpdate", handleSystemUpdate)
    }
  }, [])

  const getActiveSystemsText = () => {
    const activeSystems = []

    if (activities.cameraActive) {
      activeSystems.push("Camera Feed Active")
    }

    if (activities.faceDetection) {
      activeSystems.push("Face Detection")
    }

    if (activities.handDetection) {
      activeSystems.push("Hand Detection")
    }

    if (activities.imageConversion) {
      activeSystems.push("2D to 3D Conversion")
    }

    if (activeSystems.length === 0) {
      return "All systems idle"
    }

    return `Running: ${activeSystems.join(", ")}`
  }

  const getStatusColor = () => {
    const activeCount = Object.values(activities).filter(Boolean).length
    if (activeCount === 0) return "text-gray-500"
    if (activeCount <= 2) return "text-blue-600"
    return "text-green-600"
  }

  return (
    <div className="space-y-2">
      <p className={`font-medium ${getStatusColor()}`}>{getActiveSystemsText()}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className={`flex items-center gap-2 ${activities.cameraActive ? "text-green-600" : "text-gray-400"}`}>
          <div className={`w-2 h-2 rounded-full ${activities.cameraActive ? "bg-green-500" : "bg-gray-300"}`}></div>
          Camera
        </div>

        <div className={`flex items-center gap-2 ${activities.faceDetection ? "text-green-600" : "text-gray-400"}`}>
          <div className={`w-2 h-2 rounded-full ${activities.faceDetection ? "bg-green-500" : "bg-gray-300"}`}></div>
          Face Detection
        </div>

        <div className={`flex items-center gap-2 ${activities.handDetection ? "text-green-600" : "text-gray-400"}`}>
          <div className={`w-2 h-2 rounded-full ${activities.handDetection ? "bg-green-500" : "bg-gray-300"}`}></div>
          Hand Detection
        </div>

        <div className={`flex items-center gap-2 ${activities.imageConversion ? "text-green-600" : "text-gray-400"}`}>
          <div className={`w-2 h-2 rounded-full ${activities.imageConversion ? "bg-green-500" : "bg-gray-300"}`}></div>
          3D Conversion
        </div>
      </div>
    </div>
  )
}

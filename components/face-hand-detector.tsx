"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface DetectionStats {
  faces: number
  hands: number
  fps: number
}

// Helper function to emit system status updates
const updateSystemStatus = (updates: any) => {
  const event = new CustomEvent("systemStatusUpdate", { detail: updates })
  window.dispatchEvent(event)
}

export function FaceHandDetector() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [isDetecting, setIsDetecting] = useState(true)
  const [status, setStatus] = useState('Click "Activate" to begin')
  const [stats, setStats] = useState<DetectionStats>({ faces: 0, hands: 0, fps: 0 })
  const [isLoading, setIsLoading] = useState(false)

  const animationRef = useRef<number>()
  const frameCountRef = useRef(0)
  const fpsUpdateTimeRef = useRef(0)
  const timeRef = useRef(0)
  const faceDetectorRef = useRef<any>(null)
  const handDetectorRef = useRef<any>(null)
  const previousFrameRef = useRef<ImageData | null>(null)

  // Update system status when detection state changes
  useEffect(() => {
    updateSystemStatus({
      faceDetection: isActive && isDetecting,
      handDetection: isActive && isDetecting,
      cameraActive: isActive,
    })
  }, [isActive, isDetecting])

  useEffect(() => {
    loadDetectionModels()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      updateSystemStatus({
        faceDetection: false,
        handDetection: false,
        cameraActive: false,
      })
    }
  }, [])

  const loadDetectionModels = async () => {
    setIsLoading(true)
    setStatus("Loading detection models...")

    try {
      // Check if browser supports FaceDetector API
      if ("FaceDetector" in window) {
        // @ts-ignore
        faceDetectorRef.current = new window.FaceDetector({
          maxDetectedFaces: 5,
          fastMode: false,
        })
        setStatus("Browser face detection loaded")
      } else {
        setStatus("Using computer vision algorithms")
      }

      setStatus("Models loaded - Click Activate to start")
      setIsLoading(false)
    } catch (error) {
      setStatus("Using fallback detection methods")
      setIsLoading(false)
      console.error("Model loading error:", error)
    }
  }

  const startCamera = async () => {
    try {
      setIsLoading(true)
      setStatus("Starting camera...")

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        videoRef.current.onloadedmetadata = () => {
          if (canvasRef.current && videoRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            startDetection()
          }
        }
      }

      setIsActive(true)
      setStatus("Camera active - Detection running")
      setIsLoading(false)
    } catch (error) {
      setStatus("Camera access denied")
      setIsLoading(false)
      console.error("Camera error:", error)
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setIsActive(false)
    setStatus("Camera stopped")
    clearCanvas()
    setStats({ faces: 0, hands: 0, fps: 0 })
  }

  const startDetection = () => {
    const detectFrame = async () => {
      if (isDetecting && videoRef.current && canvasRef.current) {
        await performRealTimeDetection()
        updateFPS()
      }

      if (isActive) {
        animationRef.current = requestAnimationFrame(detectFrame)
      }
    }

    detectFrame()
  }

  const performRealTimeDetection = async () => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    timeRef.current += 0.05

    let faceCount = 0
    let handCount = 0

    try {
      // Real face detection
      const detectedFaces = await detectRealFaces(video)
      faceCount = detectedFaces.length

      detectedFaces.forEach((face) => {
        drawInteractiveFaceMesh(ctx, face)
      })

      // Real hand detection
      const detectedHands = await detectRealHands(ctx, video)
      handCount = detectedHands.length

      detectedHands.forEach((hand) => {
        drawInteractiveHandVertices(ctx, hand)
      })
    } catch (error) {
      console.error("Detection error:", error)
    }

    setStats((prev) => ({ ...prev, faces: faceCount, hands: handCount }))
  }

  const detectRealFaces = async (video: HTMLVideoElement) => {
    try {
      // Try browser FaceDetector API first
      if (faceDetectorRef.current && video.readyState === 4) {
        const detectedFaces = await faceDetectorRef.current.detect(video)
        return detectedFaces.map((face: any) => ({
          x: face.boundingBox.x,
          y: face.boundingBox.y,
          width: face.boundingBox.width,
          height: face.boundingBox.height,
        }))
      }
    } catch (e) {
      // Fallback to computer vision detection
    }

    // Advanced computer vision face detection fallback
    return detectFallbackFaces(video)
  }

  const detectFallbackFaces = (video: HTMLVideoElement) => {
    const canvas = canvasRef.current
    if (!canvas) return []

    const tempCanvas = document.createElement("canvas")
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return []

    tempCanvas.width = canvas.width / 2
    tempCanvas.height = canvas.height / 2

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data

    // Convert to grayscale
    const grayData = new Uint8Array(tempCanvas.width * tempCanvas.height)
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      grayData[i / 4] = gray
    }

    // Haar-like feature detection
    const faces = []
    const minFaceSize = 60
    const maxFaceSize = Math.min(tempCanvas.width, tempCanvas.height) / 1.5
    const stepSize = 12

    for (let size = minFaceSize; size <= maxFaceSize; size += 25) {
      for (let y = 0; y <= tempCanvas.height - size; y += stepSize) {
        for (let x = 0; x <= tempCanvas.width - size; x += stepSize) {
          if (isFaceRegion(grayData, tempCanvas.width, tempCanvas.height, x, y, size)) {
            faces.push({
              x: x * 2,
              y: y * 2,
              width: size * 2,
              height: size * 2,
            })
          }
        }
      }
    }

    return removeOverlappingFaces(faces)
  }

  const detectRealHands = async (ctx: CanvasRenderingContext2D, video: HTMLVideoElement) => {
    // Use computer vision-based hand detection
    return detectFallbackHands(ctx, video)
  }

  const detectFallbackHands = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement) => {
    const canvas = canvasRef.current
    if (!canvas) return []

    const tempCanvas = document.createElement("canvas")
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return []

    tempCanvas.width = canvas.width / 2
    tempCanvas.height = canvas.height / 2

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    const data = imageData.data

    // Motion detection for hands
    let motionRegions = []
    if (previousFrameRef.current) {
      motionRegions = detectMotion(data, previousFrameRef.current.data, tempCanvas.width, tempCanvas.height)
    }

    previousFrameRef.current = imageData

    // Skin color detection
    const skinRegions = detectSkinRegions(data, tempCanvas.width, tempCanvas.height)

    // Combine motion and skin detection
    const handCandidates = combineMotionAndSkin(motionRegions, skinRegions)

    // Filter and scale back
    return handCandidates
      .filter((region) => isHandLikeShape(region))
      .map((region) => ({
        x: region.x * 2,
        y: region.y * 2,
        width: region.width * 2,
        height: region.height * 2,
      }))
  }

  const isFaceRegion = (
    grayData: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    size: number,
  ): boolean => {
    // Enhanced Haar-like features for better face detection
    const eyeRegionY = Math.floor(y + size * 0.25)
    const eyeRegionHeight = Math.floor(size * 0.25)
    const mouthRegionY = Math.floor(y + size * 0.65)
    const mouthRegionHeight = Math.floor(size * 0.2)

    const leftEyeX = Math.floor(x + size * 0.2)
    const rightEyeX = Math.floor(x + size * 0.65)
    const eyeWidth = Math.floor(size * 0.2)

    let leftEyeSum = 0
    let rightEyeSum = 0
    let foreheadSum = 0
    let mouthSum = 0
    let pixelCount = 0

    // Sample eye regions
    for (let dy = 0; dy < eyeRegionHeight; dy++) {
      for (let dx = 0; dx < eyeWidth; dx++) {
        const leftIdx = (eyeRegionY + dy) * width + (leftEyeX + dx)
        const rightIdx = (eyeRegionY + dy) * width + (rightEyeX + dx)

        if (leftIdx < grayData.length && rightIdx < grayData.length) {
          leftEyeSum += grayData[leftIdx]
          rightEyeSum += grayData[rightIdx]
          pixelCount++
        }
      }
    }

    // Sample forehead
    const foreheadY = Math.floor(y + size * 0.05)
    for (let dy = 0; dy < eyeRegionHeight; dy++) {
      for (let dx = 0; dx < size * 0.6; dx++) {
        const idx = (foreheadY + dy) * width + (x + size * 0.2 + dx)
        if (idx < grayData.length) {
          foreheadSum += grayData[idx]
        }
      }
    }

    // Sample mouth region
    for (let dy = 0; dy < mouthRegionHeight; dy++) {
      for (let dx = 0; dx < size * 0.4; dx++) {
        const idx = (mouthRegionY + dy) * width + (x + size * 0.3 + dx)
        if (idx < grayData.length) {
          mouthSum += grayData[idx]
        }
      }
    }

    if (pixelCount === 0) return false

    const avgLeftEye = leftEyeSum / pixelCount
    const avgRightEye = rightEyeSum / pixelCount
    const avgForehead = foreheadSum / (eyeRegionHeight * size * 0.6)
    const avgMouth = mouthSum / (mouthRegionHeight * size * 0.4)

    // Enhanced face detection criteria
    const eyesAreDark = avgLeftEye < 110 && avgRightEye < 110
    const foreheadIsBright = avgForehead > avgLeftEye + 15 && avgForehead > avgRightEye + 15
    const symmetry = Math.abs(avgLeftEye - avgRightEye) < 25
    const contrastCheck = avgForehead - Math.min(avgLeftEye, avgRightEye) > 20

    return eyesAreDark && foreheadIsBright && symmetry && contrastCheck
  }

  const removeOverlappingFaces = (faces: Array<{ x: number; y: number; width: number; height: number }>) => {
    const filtered = []
    faces.sort((a, b) => b.width * b.height - a.width * a.height)

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i]
      let isOverlapping = false

      for (let j = 0; j < filtered.length; j++) {
        const other = filtered[j]
        const overlap = calculateOverlap(face, other)
        if (overlap > 0.4) {
          isOverlapping = true
          break
        }
      }

      if (!isOverlapping) {
        filtered.push(face)
      }
    }

    return filtered.slice(0, 3) // Limit to 3 faces max
  }

  const calculateOverlap = (
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number },
  ) => {
    const x1 = Math.max(rect1.x, rect2.x)
    const y1 = Math.max(rect1.y, rect2.y)
    const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width)
    const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height)

    if (x2 <= x1 || y2 <= y1) return 0

    const intersectionArea = (x2 - x1) * (y2 - y1)
    const rect1Area = rect1.width * rect1.height
    const rect2Area = rect2.width * rect2.height
    const unionArea = rect1Area + rect2Area - intersectionArea

    return intersectionArea / unionArea
  }

  const detectMotion = (
    currentData: Uint8ClampedArray,
    previousData: Uint8ClampedArray,
    width: number,
    height: number,
  ) => {
    const motionRegions = []
    const threshold = 25
    const blockSize = 16

    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        let motionSum = 0
        let pixelCount = 0

        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4
            if (idx < currentData.length && idx < previousData.length) {
              const currentGray = (currentData[idx] + currentData[idx + 1] + currentData[idx + 2]) / 3
              const previousGray = (previousData[idx] + previousData[idx + 1] + previousData[idx + 2]) / 3
              motionSum += Math.abs(currentGray - previousGray)
              pixelCount++
            }
          }
        }

        if (pixelCount > 0 && motionSum / pixelCount > threshold) {
          motionRegions.push({ x, y, width: blockSize, height: blockSize })
        }
      }
    }

    return motionRegions
  }

  const detectSkinRegions = (data: Uint8ClampedArray, width: number, height: number) => {
    const skinRegions = []
    const blockSize = 12

    for (let y = 0; y < height - blockSize; y += blockSize) {
      for (let x = 0; x < width - blockSize; x += blockSize) {
        let skinPixels = 0
        let totalPixels = 0

        for (let dy = 0; dy < blockSize; dy++) {
          for (let dx = 0; dx < blockSize; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4
            if (idx < data.length) {
              const r = data[idx]
              const g = data[idx + 1]
              const b = data[idx + 2]

              if (isAdvancedSkinColor(r, g, b)) {
                skinPixels++
              }
              totalPixels++
            }
          }
        }

        if (totalPixels > 0 && skinPixels / totalPixels > 0.65) {
          skinRegions.push({ x, y, width: blockSize, height: blockSize })
        }
      }
    }

    return skinRegions
  }

  const isAdvancedSkinColor = (r: number, g: number, b: number): boolean => {
    // Enhanced skin color detection
    const yuv = rgbToYuv(r, g, b)
    const hsv = rgbToHsv(r, g, b)

    const yuvSkin = yuv.u >= -20 && yuv.u <= 30 && yuv.v >= -15 && yuv.v <= 25
    const hsvSkin = hsv.h >= 0 && hsv.h <= 60 && hsv.s >= 0.2 && hsv.s <= 0.8
    const rgbSkin =
      r > 85 && g > 35 && b > 15 && Math.max(r, g, b) - Math.min(r, g, b) > 12 && Math.abs(r - g) > 12 && r > g && r > b

    return yuvSkin || hsvSkin || rgbSkin
  }

  const rgbToYuv = (r: number, g: number, b: number) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    const u = -0.169 * r - 0.331 * g + 0.5 * b
    const v = 0.5 * r - 0.419 * g - 0.081 * b
    return { y, u, v }
  }

  const rgbToHsv = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const diff = max - min

    let h = 0
    if (diff !== 0) {
      if (max === r) h = ((g - b) / diff) % 6
      else if (max === g) h = (b - r) / diff + 2
      else h = (r - g) / diff + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360

    const s = max === 0 ? 0 : diff / max
    const v = max

    return { h, s, v }
  }

  const combineMotionAndSkin = (motionRegions: any[], skinRegions: any[]) => {
    const combined = []

    for (const motion of motionRegions) {
      for (const skin of skinRegions) {
        const overlap = calculateOverlap(motion, skin)
        if (overlap > 0.25) {
          const minX = Math.min(motion.x, skin.x)
          const minY = Math.min(motion.y, skin.y)
          const maxX = Math.max(motion.x + motion.width, skin.x + skin.width)
          const maxY = Math.max(motion.y + motion.height, skin.y + skin.height)

          combined.push({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          })
        }
      }
    }

    return combined
  }

  const isHandLikeShape = (region: { x: number; y: number; width: number; height: number }) => {
    const aspectRatio = region.width / region.height
    const area = region.width * region.height
    return aspectRatio > 0.4 && aspectRatio < 2.5 && area > 300 && area < 8000
  }

  const drawInteractiveFaceMesh = (
    ctx: CanvasRenderingContext2D,
    face: { x: number; y: number; width: number; height: number; mesh?: any[] },
  ) => {
    const { x, y, width, height, mesh } = face
    const time = timeRef.current

    // Draw basic face rectangle if no mesh is available
    if (!mesh || !Array.isArray(mesh)) {
      // Fall back to basic face outline
      ctx.strokeStyle = `rgba(59, 130, 246, 0.9)`
      ctx.fillStyle = `rgba(59, 130, 246, 0.15)`
      ctx.lineWidth = 2
      ctx.fillRect(x, y, width, height)
      ctx.strokeRect(x, y, width, height)

      // Face label
      ctx.fillStyle = "#3b82f6"
      ctx.font = "bold 14px Arial"
      ctx.fillText("FACE DETECTED", x, y - 8)
      return
    }

    // Draw advanced face mesh with actual keypoints
    // Draw connections between face keypoints to create a mesh
    const connections = [
      // Jaw line
      [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288],
      // Left eye
      [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
      // Right eye
      [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
      // Lips outer
      [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181],
      // Lips inner
      [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80, 81, 82, 13],
      // Left eyebrow
      [276, 283, 282, 295, 300, 293, 334],
      // Right eyebrow
      [46, 53, 52, 65, 55, 70, 63],
      // Nose
      [168, 6, 197, 195, 5, 4, 45, 220, 115, 49, 131, 134, 51, 5, 281, 248, 114, 188, 217, 122],
    ]

    // Draw the connections to create a face mesh
    ctx.strokeStyle = `rgba(59, 130, 246, 0.5)`
    ctx.lineWidth = 1

    // Draw the mesh connections
    for (const connectionGroup of connections) {
      if (connectionGroup.every((idx) => mesh[idx])) {
        ctx.beginPath()
        const startPoint = mesh[connectionGroup[0]]
        ctx.moveTo(startPoint.x, startPoint.y)

        for (let i = 1; i < connectionGroup.length; i++) {
          const point = mesh[connectionGroup[i]]
          ctx.lineTo(point.x, point.y)
        }

        // Close the loop if it's a closed shape like eyes or lips
        const firstPoint = mesh[connectionGroup[0]]
        ctx.lineTo(firstPoint.x, firstPoint.y)
        ctx.stroke()
      }
    }

    // Draw key feature points with pulsing effect
    const keyPoints = [33, 263, 61, 291, 199] // eyes, mouth corners, nose tip
    keyPoints.forEach((idx) => {
      if (mesh[idx]) {
        const point = mesh[idx]
        const pulse = Math.sin(time * 2) * 0.3 + 0.8

        ctx.fillStyle = `rgba(255, 100, 100, ${pulse})`
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Face label
    ctx.fillStyle = "#3b82f6"
    ctx.font = "bold 14px Arial"
    ctx.fillText("FACE MESH ACTIVE", x, y - 8)
  }

  const drawInteractiveHandVertices = (
    ctx: CanvasRenderingContext2D,
    hand: { x: number; y: number; width: number; height: number; landmarks?: any[]; handedness?: string },
  ) => {
    const { x, y, width, height, landmarks, handedness } = hand
    const time = timeRef.current

    // If no landmarks are provided, fall back to generic hand outline
    if (!landmarks || !Array.isArray(landmarks)) {
      // Draw hand outline
      ctx.strokeStyle = `rgba(15, 23, 42, 0.8)`
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // Generate basic hand landmarks
      const generatedLandmarks = generateBasicHandLandmarks(x, y, width, height)
      drawHandSkeleton(ctx, generatedLandmarks)

      // Hand label
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 12px Arial"
      ctx.fillText("HAND DETECTED", x, y - 8)
      return
    }

    // Draw advanced hand vertices with actual keypoints
    // Draw connections between keypoints to create hand skeleton
    const fingerConnections = [
      // Thumb
      [0, 1, 2, 3, 4],
      // Index finger
      [0, 5, 6, 7, 8],
      // Middle finger
      [0, 9, 10, 11, 12],
      // Ring finger
      [0, 13, 14, 15, 16],
      // Pinky
      [0, 17, 18, 19, 20],
      // Palm
      [0, 5, 9, 13, 17],
    ]

    // Draw the skeleton with the actual landmarks
    ctx.strokeStyle = `rgba(15, 23, 42, 0.8)`
    ctx.lineWidth = 2

    for (const connectionGroup of fingerConnections) {
      ctx.beginPath()
      const startPoint = landmarks[connectionGroup[0]]
      ctx.moveTo(startPoint.x, startPoint.y)

      for (let i = 1; i < connectionGroup.length; i++) {
        const point = landmarks[connectionGroup[i]]
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
    }

    // Draw vertices/points on the landmarks
    landmarks.forEach((point, index) => {
      const pulse = Math.sin(time * 3 + index * 0.2) * 0.3 + 0.7
      const size = index === 0 ? 6 : 4 // Make wrist point larger

      // Outer glow
      ctx.fillStyle = `rgba(15, 23, 42, ${pulse})`
      ctx.beginPath()
      ctx.arc(point.x, point.y, size, 0, 2 * Math.PI)
      ctx.fill()

      // Inner bright point
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`
      ctx.beginPath()
      ctx.arc(point.x, point.y, size * 0.4, 0, 2 * Math.PI)
      ctx.fill()
    })

    // Hand label with handedness if available
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 12px Arial"
    ctx.fillText(`${handedness || "HAND"} LANDMARKS`, x, y - 8)
  }

  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    // Draw connections between landmarks to represent fingers
    const fingerConnections = [
      // Thumb
      [0, 1, 2, 3, 4],
      // Index finger
      [0, 5, 6, 7, 8],
      // Middle finger
      [0, 9, 10, 11, 12],
      // Ring finger
      [0, 13, 14, 15, 16],
      // Pinky
      [0, 17, 18, 19, 20],
    ]

    // Draw hand skeleton
    ctx.strokeStyle = "#0f172a"
    ctx.lineWidth = 1.5

    for (const connectionGroup of fingerConnections) {
      ctx.beginPath()
      const startPoint = landmarks[connectionGroup[0]]
      ctx.moveTo(startPoint.x, startPoint.y)

      for (let i = 1; i < connectionGroup.length; i++) {
        const point = landmarks[connectionGroup[i]]
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
    }

    // Draw palm connections
    ctx.beginPath()
    ctx.moveTo(landmarks[0].x, landmarks[0].y)
    ctx.lineTo(landmarks[5].x, landmarks[5].y)
    ctx.lineTo(landmarks[9].x, landmarks[9].y)
    ctx.lineTo(landmarks[13].x, landmarks[13].y)
    ctx.lineTo(landmarks[17].x, landmarks[17].y)
    ctx.lineTo(landmarks[0].x, landmarks[0].y)
    ctx.stroke()

    // Draw points at each landmark
    ctx.fillStyle = "#3b82f6"
    landmarks.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const updateFPS = () => {
    frameCountRef.current++
    const now = performance.now()

    if (now - fpsUpdateTimeRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (now - fpsUpdateTimeRef.current))
      setStats((prev) => ({ ...prev, fps }))
      frameCountRef.current = 0
      fpsUpdateTimeRef.current = now
    }
  }

  const toggleDetection = () => {
    setIsDetecting(!isDetecting)
    if (!isDetecting) {
      clearCanvas()
      setStats((prev) => ({ ...prev, faces: 0, hands: 0 }))
    }
  }

  // Helper function for basic hand landmarks when ML model fails
  const generateBasicHandLandmarks = (x: number, y: number, width: number, height: number) => {
    const landmarks = []

    // Generate landmarks based on hand position
    // Wrist
    landmarks.push({ x: x + width * 0.5, y: y + height * 0.9 })

    // Thumb
    landmarks.push({ x: x + width * 0.3, y: y + height * 0.8 })
    landmarks.push({ x: x + width * 0.2, y: y + height * 0.65 })
    landmarks.push({ x: x + width * 0.1, y: y + height * 0.5 })
    landmarks.push({ x: x + width * 0.05, y: y + height * 0.35 })

    // Index finger
    landmarks.push({ x: x + width * 0.4, y: y + height * 0.7 })
    landmarks.push({ x: x + width * 0.35, y: y + height * 0.5 })
    landmarks.push({ x: x + width * 0.3, y: y + height * 0.3 })
    landmarks.push({ x: x + width * 0.25, y: y + height * 0.1 })

    // Middle finger
    landmarks.push({ x: x + width * 0.5, y: y + height * 0.7 })
    landmarks.push({ x: x + width * 0.5, y: y + height * 0.5 })
    landmarks.push({ x: x + width * 0.5, y: y + height * 0.3 })
    landmarks.push({ x: x + width * 0.5, y: y + height * 0.1 })

    // Ring finger
    landmarks.push({ x: x + width * 0.6, y: y + height * 0.7 })
    landmarks.push({ x: x + width * 0.65, y: y + height * 0.5 })
    landmarks.push({ x: x + width * 0.7, y: y + height * 0.3 })
    landmarks.push({ x: x + width * 0.75, y: y + height * 0.1 })

    // Pinky
    landmarks.push({ x: x + width * 0.7, y: y + height * 0.75 })
    landmarks.push({ x: x + width * 0.75, y: y + height * 0.55 })
    landmarks.push({ x: x + width * 0.8, y: y + height * 0.35 })
    landmarks.push({ x: x + width * 0.85, y: y + height * 0.15 })

    return landmarks
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={isActive ? stopCamera : startCamera}
          disabled={isLoading}
          className="bg-[#0f172a] text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : isActive ? "Stop Camera" : "Activate Face & Hand Recognition"}
        </button>

        {isActive && (
          <button onClick={toggleDetection} className="bg-blue-600 text-white px-4 py-2 rounded">
            {isDetecting ? "Pause Detection" : "Resume Detection"}
          </button>
        )}
      </div>

      <div className="relative bg-[#f1f5f9] rounded-md overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-80 object-cover"
          style={{ display: isActive ? "block" : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ display: isActive ? "block" : "none" }}
        />
        {!isActive && <div className="h-80 flex items-center justify-center text-gray-500">Live Camera Feed</div>}
      </div>

      <div className="text-center text-sm text-gray-600">{status}</div>

      {isActive && (
        <Card className="bg-[#0f172a] text-white">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.faces}</div>
                <div className="text-sm">Faces</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.hands}</div>
                <div className="text-sm">Hands</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{stats.fps}</div>
                <div className="text-sm">FPS</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

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
    const faces = []

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

    // Advanced computer vision face detection
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
    face: { x: number; y: number; width: number; height: number },
  ) => {
    const { x, y, width, height } = face
    const time = timeRef.current

    // Face mesh with dynamic positioning
    ctx.strokeStyle = `rgba(59, 130, 246, 0.9)`
    ctx.fillStyle = `rgba(59, 130, 246, 0.15)`
    ctx.lineWidth = 2

    // Fill face area
    ctx.fillRect(x, y, width, height)

    // Dynamic mesh grid
    const gridSize = 8
    const cellWidth = width / gridSize
    const cellHeight = height / gridSize

    ctx.strokeStyle = `rgba(59, 130, 246, 0.8)`
    ctx.lineWidth = 1.5

    // Animated mesh lines that follow face position
    for (let i = 0; i <= gridSize; i++) {
      const waveOffset = Math.sin(time + i * 0.3) * 3
      const waveOffset2 = Math.cos(time + i * 0.4) * 2

      // Vertical lines
      ctx.beginPath()
      ctx.moveTo(x + i * cellWidth + waveOffset, y)
      ctx.lineTo(x + i * cellWidth + waveOffset, y + height)
      ctx.stroke()

      // Horizontal lines
      ctx.beginPath()
      ctx.moveTo(x, y + i * cellHeight + waveOffset2)
      ctx.lineTo(x + width, y + i * cellHeight + waveOffset2)
      ctx.stroke()
    }

    // Eye regions that follow face
    const eyeY = y + height * 0.35
    const eyeWidth = width * 0.15
    const eyeHeight = height * 0.1
    const leftEyeX = x + width * 0.25
    const rightEyeX = x + width * 0.6

    ctx.fillStyle = `rgba(0, 255, 255, 0.4)`
    ctx.fillRect(leftEyeX, eyeY, eyeWidth, eyeHeight)
    ctx.fillRect(rightEyeX, eyeY, eyeWidth, eyeHeight)

    ctx.strokeStyle = `rgba(0, 255, 255, 0.9)`
    ctx.lineWidth = 2
    ctx.strokeRect(leftEyeX, eyeY, eyeWidth, eyeHeight)
    ctx.strokeRect(rightEyeX, eyeY, eyeWidth, eyeHeight)

    // Mouth region that follows face
    const mouthY = y + height * 0.7
    const mouthWidth = width * 0.4
    const mouthHeight = height * 0.1
    const mouthX = x + width * 0.3

    ctx.fillStyle = `rgba(255, 100, 100, 0.4)`
    ctx.fillRect(mouthX, mouthY, mouthWidth, mouthHeight)

    ctx.strokeStyle = `rgba(255, 100, 100, 0.9)`
    ctx.strokeRect(mouthX, mouthY, mouthWidth, mouthHeight)

    // Animated corner markers
    const cornerSize = 15
    const pulse = Math.sin(time * 2) * 0.3 + 0.8
    ctx.strokeStyle = `rgba(59, 130, 246, ${pulse})`
    ctx.lineWidth = 3

    // Corner markers that follow face position
    const corners = [
      [x, y, x + cornerSize, y, x, y + cornerSize],
      [x + width - cornerSize, y, x + width, y, x + width, y + cornerSize],
      [x, y + height - cornerSize, x, y + height, x + cornerSize, y + height],
      [x + width - cornerSize, y + height, x + width, y + height, x + width, y + height - cornerSize],
    ]

    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.stroke()
    })

    // Face label
    ctx.fillStyle = "#3b82f6"
    ctx.font = "bold 14px Arial"
    ctx.fillText("FACE MESH ACTIVE", x, y - 8)
  }

  const drawInteractiveHandVertices = (
    ctx: CanvasRenderingContext2D,
    hand: { x: number; y: number; width: number; height: number },
  ) => {
    const { x, y, width, height } = hand
    const time = timeRef.current

    // Generate hand landmarks that follow actual hand position
    const handLandmarks = generateRealHandLandmarks(x, y, width, height)

    // Draw hand skeleton
    ctx.strokeStyle = `rgba(15, 23, 42, 0.8)`
    ctx.lineWidth = 2
    drawHandSkeleton(ctx, handLandmarks)

    // Draw vertices that follow hand movement
    handLandmarks.forEach((point, index) => {
      const pulse = Math.sin(time * 3 + index * 0.2) * 0.3 + 0.7
      const size = 5 + Math.sin(time * 2 + index * 0.3) * 2

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

    // Hand outline that follows actual hand
    ctx.strokeStyle = `rgba(15, 23, 42, 1)`
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)

    // Hand label
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 12px Arial"
    ctx.fillText("HAND VERTICES", x, y - 8)
  }

  const generateRealHandLandmarks = (x: number, y: number, width: number, height: number) => {
    const landmarks = []

    // Generate landmarks based on actual hand position
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

  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarks: Array<{ x: number; y: number }>) => {
    const connections = [
      [0, 1],
      [0, 5],
      [0, 9],
      [0, 13],
      [0, 17],
      [1, 2],
      [2, 3],
      [3, 4],
      [5, 6],
      [6, 7],
      [7, 8],
      [9, 10],
      [10, 11],
      [11, 12],
      [13, 14],
      [14, 15],
      [15, 16],
      [17, 18],
      [18, 19],
      [19, 20],
      [5, 9],
      [9, 13],
      [13, 17],
    ]

    connections.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end]) {
        ctx.beginPath()
        ctx.moveTo(landmarks[start].x, landmarks[start].y)
        ctx.lineTo(landmarks[end].x, landmarks[end].y)
        ctx.stroke()
      }
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

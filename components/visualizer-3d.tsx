"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

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

interface PointCloudProps {
  data: ThreeJSData
}

function PointCloud({ data }: PointCloudProps) {
  const meshRef = useRef<THREE.Points>(null)
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (!data.vertices || !data.colors) return

    const geo = new THREE.BufferGeometry()

    // Convert vertices array to Float32Array
    const vertices = new Float32Array(data.vertices)
    const colors = new Float32Array(data.colors)

    console.log("Creating geometry with:", {
      verticesLength: vertices.length,
      colorsLength: colors.length,
      expectedPoints: vertices.length / 3,
    })

    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3))
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    // Center the geometry
    geo.computeBoundingBox()
    if (geo.boundingBox) {
      const center = geo.boundingBox.getCenter(new THREE.Vector3())
      const size = geo.boundingBox.getSize(new THREE.Vector3())

      // Scale the geometry to fit nicely in view
      const maxDimension = Math.max(size.x, size.y, size.z)
      const scale = 2 / maxDimension // Scale to fit in a 2-unit cube

      geo.translate(-center.x, -center.y, -center.z)
      geo.scale(scale, scale, scale)

      console.log("Geometry centered and scaled:", { center, size, scale })
    }

    setGeometry(geo)
  }, [data])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003
    }
  })

  if (!geometry) return null

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial size={0.015} vertexColors sizeAttenuation />
    </points>
  )
}

interface Visualizer3DProps {
  threejsData: ThreeJSData | null
  isLoading: boolean
}

export function Visualizer3D({ threejsData, isLoading }: Visualizer3DProps) {
  if (isLoading) {
    return (
      <div className="w-full h-80 bg-[#f1f5f9] rounded-md flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Converting to 3D...</p>
        </div>
      </div>
    )
  }

  if (!threejsData) {
    return (
      <div className="w-full h-80 bg-[#f1f5f9] rounded-md flex items-center justify-center text-gray-500">
        3D Preview Area (Upload an image)
      </div>
    )
  }

  return (
    <div className="w-full h-80 bg-black rounded-md overflow-hidden">
      <Canvas camera={{ position: [0, 0, 3], fov: 75 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} />
        <PointCloud data={threejsData} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={1} maxDistance={10} />
        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

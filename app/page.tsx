import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FaceHandDetector } from "@/components/face-hand-detector"
import { TwoDToThreeDVisualizer } from "@/components/2d-to-3d-visualizer"
import { DirectApiVisualizer } from "@/components/direct-api-visualizer"
import { SystemStatus } from "@/components/system-status"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-blue-600 p-4 md:p-6">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Vision Tools Dashboard</h1>
          <span className="text-white">v1.0</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2D to 3D Visualizer Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">2D to 3D Visualizer</CardTitle>
            </CardHeader>
            <CardContent>
              <DirectApiVisualizer />
              <div className="mt-4 border-t pt-4">
                <h3 className="text-lg font-semibold mb-2">Upload Your Image</h3>
                <TwoDToThreeDVisualizer />
              </div>
            </CardContent>
          </Card>

          {/* Vision System Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">Vision System</CardTitle>
            </CardHeader>
            <CardContent>
              <FaceHandDetector />
            </CardContent>
          </Card>
        </div>

        {/* System Status Card */}
        <Card className="mt-6 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <SystemStatus />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

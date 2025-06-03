import { Upload, Eye, Maximize } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-blue-600 p-4 md:p-6">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-white">AI Vision Tools Dashboard</h1>
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
            <CardContent className="space-y-4">
              <button className="flex items-center gap-2 text-lg font-medium">
                <Upload className="h-5 w-5" />
                Upload 2D Image
              </button>

              <button className="w-full bg-[#0f172a] text-white py-3 rounded flex items-center justify-center gap-2">
                <Eye className="h-5 w-5" />
                Start Visualizer
              </button>

              <div className="bg-[#f1f5f9] rounded-md h-80 flex items-center justify-center text-gray-500">
                3D Preview Area (Upload an image)
              </div>
            </CardContent>
          </Card>

          {/* Vision System Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">Vision System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <button className="w-full bg-[#0f172a] text-white py-3 rounded flex items-center justify-center gap-2">
                <Maximize className="h-5 w-5" />
                Activate Face & Hand Recognition
              </button>

              <div className="bg-[#f1f5f9] rounded-md h-80 flex items-center justify-center text-gray-500">
                Live Camera Feed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Status Card */}
        <Card className="mt-6 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-600">Running 2D to 3D Visualization...</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

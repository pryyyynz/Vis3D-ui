"use client"

import { useState } from "react"

const API_BASE_URL = "https://miniature-space-trout-r5gx4664j7rfjqv-8000.app.github.dev"

export function ApiTester() {
  const [testResult, setTestResult] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const testApiEndpoint = async () => {
    setIsLoading(true)
    setTestResult("")

    try {
      // Test basic connectivity
      const response = await fetch(`${API_BASE_URL}/api/v1/convert`, {
        method: "OPTIONS",
      })

      setTestResult(`OPTIONS request: ${response.status} ${response.statusText}\n`)

      // Test with a simple GET request
      try {
        const getResponse = await fetch(`${API_BASE_URL}/api/v1/convert`, {
          method: "GET",
        })
        setTestResult((prev) => prev + `GET request: ${getResponse.status} ${getResponse.statusText}\n`)
      } catch (e) {
        setTestResult((prev) => prev + `GET request failed: ${e}\n`)
      }

      // Test with empty POST
      try {
        const postResponse = await fetch(`${API_BASE_URL}/api/v1/convert`, {
          method: "POST",
          body: new FormData(),
        })
        const postText = await postResponse.text()
        setTestResult((prev) => prev + `Empty POST: ${postResponse.status} - ${postText.substring(0, 200)}\n`)
      } catch (e) {
        setTestResult((prev) => prev + `Empty POST failed: ${e}\n`)
      }
    } catch (error) {
      setTestResult(`Connection failed: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={testApiEndpoint}
        disabled={isLoading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isLoading ? "Testing..." : "Test API Connection"}
      </button>

      {testResult && (
        <div className="bg-gray-50 border rounded-md p-3">
          <p className="text-sm font-medium mb-2">API Test Results:</p>
          <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}
    </div>
  )
}

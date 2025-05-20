"use client"

import { useSearchParams } from "next/navigation"

export default function LoginError() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  if (!error) return null

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
      <span className="block sm:inline">{error}</span>
    </div>
  )
}

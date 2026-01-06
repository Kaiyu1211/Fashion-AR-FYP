import AIBodyMeasure from '@/components/AIBodyMeasure'

export default function MeasurePage() {
  return (
    <main className="min-h-screen p-10 bg-gray-50 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">AI Body Measurement</h1>
      <AIBodyMeasure />
    </main>
  )
}
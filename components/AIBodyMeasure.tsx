// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export default function AIBodyMeasure() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [poseLandmarker, setPoseLandmarker] = useState<any>(null)
  const [shoulderWidth, setShoulderWidth] = useState<number>(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [statusText, setStatusText] = useState("Initializing AI...")

  // 1. Load AI Model
  useEffect(() => {
    async function loadModel() {
      try {
        console.log("Step 1: Downloading WASM...")
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        
        console.log("Step 2: Loading Model File...")
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        })
        
        setPoseLandmarker(landmarker)
        setStatusText("AI Ready! Click Start.")
        console.log("Step 3: AI Model Loaded Successfully!")
      } catch (error) {
        console.error("AI Load Error:", error)
        setStatusText("Error: " + error.message)
      }
    }
    loadModel()
  }, [])

  // 2. Start Camera
  const startCamera = async () => {
    console.log("Button Clicked. Requesting Camera...")
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Browser API not supported. Are you on localhost?")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      })
      
      console.log("Camera Access Granted!")
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // 强制播放视频，有时候浏览器需要这一步
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setCameraActive(true)
          console.log("Video Playing...")
          predictWebcam()
        }
      }
    } catch (error) {
      console.error("Camera Error:", error)
      alert("Camera failed: " + error.name)
    }
  }

  // 3. AI Loop
  async function predictWebcam() {
    if (!poseLandmarker || !videoRef.current || !canvasRef.current) return

    let startTimeMs = performance.now()
    
    // Detect Pose
    const results = poseLandmarker.detectForVideo(videoRef.current, startTimeMs)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const video = videoRef.current
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]

      // Draw Shoulders
      ctx.fillStyle = "#00FF00" // Green dots
      ctx.beginPath()
      ctx.arc(leftShoulder.x * canvas.width, leftShoulder.y * canvas.height, 10, 0, 2 * Math.PI)
      ctx.arc(rightShoulder.x * canvas.width, rightShoulder.y * canvas.height, 10, 0, 2 * Math.PI)
      ctx.fill()
      
      // Calculate distance
      const dx = (leftShoulder.x - rightShoulder.x) * canvas.width
      const dy = (leftShoulder.y - rightShoulder.y) * canvas.height
      const distance = Math.sqrt(dx * dx + dy * dy)
      setShoulderWidth(Math.round(distance))
    }

    if (video.readyState >= 2) {
      window.requestAnimationFrame(predictWebcam)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative w-full max-w-[640px] aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-gray-800">
        <video 
          ref={videoRef} 
          playsInline
          muted 
          className="absolute top-0 left-0 w-full h-full object-cover" 
        ></video>
        
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover z-10"
        ></canvas>

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 text-white p-4 text-center">
             <p className="mb-4 text-lg font-mono text-yellow-400">{statusText}</p>
             
             <button 
               onClick={startCamera}
               disabled={!poseLandmarker}
               className={`px-8 py-3 rounded-full font-bold shadow-lg transition-all ${
                 poseLandmarker 
                   ? 'bg-blue-600 hover:bg-blue-500 scale-100' 
                   : 'bg-gray-600 opacity-50 cursor-not-allowed'
               }`}
             >
               {poseLandmarker ? "📸 Open Camera" : "⏳ Wait..."}
             </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-white rounded-lg shadow w-full max-w-md text-center">
        <h2 className="text-2xl font-bold">Shoulder Width: {shoulderWidth}</h2>
      </div>
    </div>
  )
}
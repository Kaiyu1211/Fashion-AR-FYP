// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { createClient } from '@/utils/supabase/client'

export default function AIBodyMeasure() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [poseLandmarker, setPoseLandmarker] = useState<any>(null)
  const [userHeight, setUserHeight] = useState<string>('')
  const [shoulderWidthCm, setShoulderWidthCm] = useState<number>(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function loadModel() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/pose_landmarker_lite.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
      })
      setPoseLandmarker(landmarker)
    }
    loadModel()
  }, [])

  const startCamera = async () => {
    if (!userHeight) {
      alert("Please enter your height first! (请先输入身高)")
      return
    }
    // 强制请求 1280x720，但手机可能会忽略，所以下面我们要动态调整
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 720 },
        facingMode: "user" // 强制使用前置摄像头
      } 
    })
    
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play()
        setCameraActive(true)
        predictWebcam()
      }
    }
  }

  async function predictWebcam() {
    if (!poseLandmarker || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // --- 修复坐标的核心代码 ---
    // 1. 让 Canvas 的分辨率严格等于视频的真实分辨率
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    
    // --- 结束修复 ---

    let startTimeMs = performance.now()
    const results = poseLandmarker.detectForVideo(video, startTimeMs)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]

      // 画点
      ctx.fillStyle = "#00FF00"
      ctx.beginPath()
      ctx.arc(leftShoulder.x * canvas.width, leftShoulder.y * canvas.height, 10, 0, 2 * Math.PI)
      ctx.arc(rightShoulder.x * canvas.width, rightShoulder.y * canvas.height, 10, 0, 2 * Math.PI)
      ctx.fill()

      // 画线连接两个肩膀
      ctx.strokeStyle = "#00FF00"
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(leftShoulder.x * canvas.width, leftShoulder.y * canvas.height)
      ctx.lineTo(rightShoulder.x * canvas.width, rightShoulder.y * canvas.height)
      ctx.stroke()

      const dx = leftShoulder.x - rightShoulder.x
      const dy = leftShoulder.y - rightShoulder.y
      const pixelDistance = Math.sqrt(dx * dx + dy * dy)
      
      const estimatedWidth = (parseInt(userHeight) * 0.23) + (pixelDistance * 5) // 系数微调
      setShoulderWidthCm(Math.round(estimatedWidth))
    }

    if (cameraActive) {
      window.requestAnimationFrame(predictWebcam)
    }
  }

  const saveProfile = async () => {
    setIsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("You are not logged in! (请先登录)")
      setIsSaving(false)
      return
    }
    const size = shoulderWidthCm > 45 ? 'L' : (shoulderWidthCm > 40 ? 'M' : 'S')
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        height_cm: parseInt(userHeight),
        shoulder_width_cm: shoulderWidthCm,
        top_size_recommendation: size,
        updated_at: new Date()
      })
    if (error) { console.error(error); alert("Save failed!"); } 
    else { alert(`Saved! Recommended: ${size}`); }
    setIsSaving(false)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      
      {!cameraActive && (
        <div className="bg-white p-6 rounded-xl shadow w-full">
          <label className="block text-sm font-bold mb-2">Step 1: Enter Height (cm)</label>
          <input 
            type="number" 
            value={userHeight}
            onChange={(e) => setUserHeight(e.target.value)}
            placeholder="e.g. 175"
            className="w-full border p-3 rounded-lg mb-4"
          />
          {poseLandmarker ? (
            <button onClick={startCamera} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
              📸 Open Camera
            </button>
          ) : (
            <p className="text-gray-500 text-center">Loading AI...</p>
          )}
        </div>
      )}

      {/* 修复 CSS: 
         1. 移除 aspect-video，让高度自动适应 (h-auto)
         2. 使用 transform: scaleX(-1) 实现镜像效果，这样你在屏幕上看到的就像照镜子一样
      */}
      <div className={`relative w-full bg-black rounded-xl overflow-hidden ${!cameraActive ? 'hidden' : ''}`}>
        
        {/* 视频层：镜像翻转 */}
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          className="w-full h-auto"
          style={{ transform: 'scaleX(-1)' }} 
        ></video>
        
        {/* 画布层：必须和视频层一样镜像翻转，否则点是对称反着的 */}
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        ></canvas>

      </div>

      {cameraActive && (
        <div className="bg-white p-6 rounded-xl shadow w-full text-center">
          <h2 className="text-4xl font-black text-blue-600 my-2">{shoulderWidthCm} cm</h2>
          <p className="mb-4">Estimated Shoulder Width</p>
          <button onClick={saveProfile} disabled={isSaving} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">
            {isSaving ? "Saving..." : "💾 Save"}
          </button>
        </div>
      )}
    </div>
  )
}
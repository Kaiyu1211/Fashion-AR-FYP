// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { createClient } from '@/utils/supabase/client'

export default function AIBodyMeasure() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // --- 关键修复：使用 Ref 来控制循环，而不是 State ---
  const isLooping = useRef(false) 
  const requestRef = useRef<number>()
  
  const [poseLandmarker, setPoseLandmarker] = useState<any>(null)
  const [userHeight, setUserHeight] = useState<string>('')
  const [shoulderWidthCm, setShoulderWidthCm] = useState<number>(0)
  const [cameraActive, setCameraActive] = useState(false) // 仅用于 UI 显示
  const [isSaving, setIsSaving] = useState(false)

  // 平滑动画坐标记录
  const smoothPos = useRef({
    leftX: 0, leftY: 0,
    rightX: 0, rightY: 0
  })

  const supabase = createClient()

  // 1. 加载模型
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
    
    // 组件卸载时强制停止循环，防止报错
    return () => {
      isLooping.current = false
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [])

  // 2. 启动摄像头
  const startCamera = async () => {
    if (!userHeight) {
      alert("Please enter your height first! (请先输入身高)")
      return
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: "user" 
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          
          // --- 关键修复点 ---
          // 先把开关打开，再启动引擎
          isLooping.current = true 
          setCameraActive(true) // 更新 UI
          predictWebcam() // 启动循环
        }
      }
    } catch (err) {
      console.error(err)
      alert("Camera fail: " + err.name)
    }
  }

  // 辅助函数：平滑移动 (Lerp)
  const lerp = (start, end, factor) => start + (end - start) * factor

  // 3. 预测循环 (这是引擎)
  async function predictWebcam() {
    // 如果开关关了，或者组件没了，直接停止
    if (!isLooping.current || !poseLandmarker || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // 确保 Canvas 尺寸正确
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    
    let startTimeMs = performance.now()
    // 获取 AI 结果
    const results = poseLandmarker.detectForVideo(video, startTimeMs)

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]
      
      // 获取目标点
      const targetLeftX = landmarks[11].x * canvas.width
      const targetLeftY = landmarks[11].y * canvas.height
      const targetRightX = landmarks[12].x * canvas.width
      const targetRightY = landmarks[12].y * canvas.height

      // 平滑处理 (如果不动，试着把 0.2 改成 0.5 让他动快点)
      smoothPos.current.leftX = lerp(smoothPos.current.leftX || targetLeftX, targetLeftX, 0.4)
      smoothPos.current.leftY = lerp(smoothPos.current.leftY || targetLeftY, targetLeftY, 0.4)
      smoothPos.current.rightX = lerp(smoothPos.current.rightX || targetRightX, targetRightX, 0.4)
      smoothPos.current.rightY = lerp(smoothPos.current.rightY || targetRightY, targetRightY, 0.4)

      const lx = smoothPos.current.leftX
      const ly = smoothPos.current.leftY
      const rx = smoothPos.current.rightX
      const ry = smoothPos.current.rightY

      // --- 绘制 UI ---
      
      // 1. 虚线
      ctx.beginPath()
      ctx.setLineDash([10, 10])
      ctx.moveTo(lx, ly)
      ctx.lineTo(rx, ry)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.setLineDash([])

      // 2. 光圈
      const drawTracker = (x, y) => {
        ctx.beginPath()
        ctx.arc(x, y, 12, 0, 2 * Math.PI)
        ctx.strokeStyle = "white"
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.fillStyle = "#00BFFF" 
        ctx.shadowBlur = 10 
        ctx.shadowColor = "#00BFFF"
        ctx.fill()
        ctx.shadowBlur = 0
      }

      drawTracker(lx, ly)
      drawTracker(rx, ry)

      // 计算距离
      const dx = lx - rx
      const dy = ly - ry
      const pixelDistance = Math.sqrt(dx * dx + dy * dy)
      
      const estimatedWidth = (parseInt(userHeight) * 0.23) + (pixelDistance * 5)
      setShoulderWidthCm(Math.round(estimatedWidth))
    }

    // --- 关键：只要开关开着，就继续下一帧 ---
    if (isLooping.current) {
      requestRef.current = requestAnimationFrame(predictWebcam)
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

      {/* 镜像翻转 */}
      <div className={`relative w-full bg-black rounded-xl overflow-hidden shadow-2xl ${!cameraActive ? 'hidden' : ''}`}>
        <video 
          ref={videoRef} 
          playsInline 
          muted 
          className="w-full h-auto"
          style={{ transform: 'scaleX(-1)' }} 
        ></video>
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        ></canvas>
        
        <div className="absolute top-4 left-0 right-0 text-center z-10">
          <span className="bg-black/50 text-white px-4 py-1 rounded-full text-sm backdrop-blur-sm">
             Adjust position until trackers align with shoulders
          </span>
        </div>
      </div>

      {cameraActive && (
        <div className="bg-white p-6 rounded-xl shadow w-full text-center transition-all">
          <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 my-2">
            {shoulderWidthCm} <span className="text-2xl text-gray-400">cm</span>
          </h2>
          <p className="mb-4 text-gray-500 font-medium">Estimated Shoulder Width</p>
          <button onClick={saveProfile} disabled={isSaving} className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition">
            {isSaving ? "Saving..." : "💾 Save Profile"}
          </button>
        </div>
      )}
    </div>
  )
}
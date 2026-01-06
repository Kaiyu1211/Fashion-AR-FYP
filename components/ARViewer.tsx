// @ts-nocheck
'use client'

import '@google/model-viewer'

// 为了防止 TypeScript 报错，我们需要告诉它 model-viewer 是什么
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': any;
    }
  }
}

export default function ARViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="w-full h-[400px] bg-gray-100 rounded-lg overflow-hidden relative">
      <model-viewer
        src={modelUrl}
        ios-src="" // 如果你有 iOS 专用格式 (.usdz) 放这里，现在先空着
        alt="A 3D model of a shoe"
        ar // 关键！开启 AR 模式
        ar-modes="webxr scene-viewer quick-look"
        camera-controls // 允许用户旋转缩放
        auto-rotate // 自动旋转展示
        shadow-intensity="1"
        style={{ width: '100%', height: '100%' }}
      >
        {/* 自定义 AR 按钮 */}
        <button slot="ar-button" className="absolute bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-lg hover:scale-105 transition">
          👋 Activate AR
        </button>
      </model-viewer>
    </div>
  )
}
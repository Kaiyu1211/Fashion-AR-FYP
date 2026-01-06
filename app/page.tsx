'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
// 动态引入 AR 组件，防止 Next.js 服务端渲染报错
import dynamic from 'next/dynamic'

// 这一步很重要：告诉 Next.js 这个组件只能在浏览器加载
const ARViewer = dynamic(() => import('@/components/ARViewer'), { 
  ssr: false,
  loading: () => <p className="text-center p-10">Loading 3D Engine...</p>
})

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  // 这里的状态用来记录：用户当前正在试穿哪件衣服的 3D 模型？如果是 null，说明没在试穿。
  const [activeModelUrl, setActiveModelUrl] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    async function getProducts() {
      const { data } = await supabase.from('products').select('*')
      if (data) setProducts(data)
    }
    getProducts()
  }, [])

  return (
    <main className="min-h-screen p-10 bg-gray-50 relative">
      <h1 className="text-4xl font-bold mb-8 text-center">Fashion AR Store</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-lg shadow-md border">
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="w-full h-48 object-cover rounded-md mb-4"
            />
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <p className="text-lg font-bold text-blue-600">${product.price}</p>
            
            <div className="mt-4 flex gap-2">
               <button className="flex-1 bg-black text-white py-2 rounded-md">Buy Now</button>
               
               {/* 点击这里，把当前衣服的 3D 链接设为激活状态 */}
               <button 
                 onClick={() => setActiveModelUrl(product.model_url)}
                 className="flex-1 border border-black py-2 rounded-md hover:bg-gray-100 font-medium"
               >
                 Try AR (3D)
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* 这是一个全屏的弹出窗口 (Modal) */}
      {activeModelUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden relative">
            
            {/* 关闭按钮 */}
            <button 
              onClick={() => setActiveModelUrl(null)}
              className="absolute top-4 right-4 z-10 bg-gray-200 p-2 rounded-full hover:bg-gray-300"
            >
              ❌ Close
            </button>

            <div className="p-6">
              <h3 className="text-2xl font-bold mb-4">Virtual Try-On</h3>
              <p className="mb-4 text-gray-600">
                Use your mouse to rotate. On mobile, click "Activate AR" to view in your room.
              </p>
              
              {/* 这里调用我们的 AR 组件 */}
              <ARViewer modelUrl={activeModelUrl} />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
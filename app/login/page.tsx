'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 登录逻辑
  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      router.push('/') // 登录成功，跳回首页
      router.refresh()
    }
    setLoading(false)
  }

  // 注册逻辑
  const handleSignUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Sign up successful! You are now logged in.')
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border">
        <h1 className="text-2xl font-bold mb-6 text-center">Welcome Back</h1>
        
        <div className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-3 rounded-lg w-full"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-3 rounded-lg w-full"
          />
          
          <button
            onClick={handleLogin}
            disabled={loading}
            className="bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition"
          >
            {loading ? 'Processing...' : 'Log In'}
          </button>
          
          <div className="text-center text-gray-500 text-sm my-2">OR</div>

          <button
            onClick={handleSignUp}
            disabled={loading}
            className="border border-black text-black py-3 rounded-lg font-bold hover:bg-gray-100 transition"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}
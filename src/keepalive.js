// keepAlive.js - SIMPLIFIED: Only handles API pings, session management moved to AuthContext
// REMOVED: Duplicate focus handlers (now handled in AuthContext.jsx only)

const API_URL = import.meta.env.VITE_API_URL || 'https://uniadvisor-ai.onrender.com/'
const PING_INTERVAL = 5 * 60 * 1000 // 5 minutes

let pingInterval = null
let isRunning = false

// Start pinging
export const startKeepAlive = () => {
  if (isRunning) {
    console.log('⚠️ Keep-alive already running')
    return
  }
  
  isRunning = true
  console.log('🏓 Starting keep-alive pings...')
  console.log('📡 Pinging', API_URL + '/api/ping', 'every 5 minutes')
  
  // Ping immediately
  pingAPI()
  
  // Then ping every 5 minutes
  pingInterval = setInterval(() => {
    pingAPI()
  }, PING_INTERVAL)
}

// Stop pinging
export const stopKeepAlive = () => {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
    isRunning = false
    console.log('🛑 Stopped keep-alive pings')
  }
}

// Ping the API
const pingAPI = async () => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
    
    const response = await fetch(`${API_URL}/api/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Keep-alive ping successful:', data.timestamp)
    } else {
      console.warn('⚠️ Keep-alive ping failed:', response.status)
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('⚠️ Keep-alive ping timeout (API may be sleeping)')
    } else {
      console.error('❌ Keep-alive ping error:', error.message)
    }
  }
}

// ⚠️ REMOVED: All visibility/focus handlers
// These are now handled in AuthContext.jsx to avoid duplicates

// Auto-start on import
if (typeof window !== 'undefined') {
  // Start immediately when module loads
  startKeepAlive()
}

export default { startKeepAlive, stopKeepAlive }
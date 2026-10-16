/**
 * 一次性诊断脚本：确认 view 端点的 -412 是「视频问题」还是「出口 IP 问题」。
 * 不是交付物的一部分，跑完就删。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

let buvid3 = ''
try {
  const r = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
  })
  const j = await r.json()
  buvid3 = j.data?.b_3 ?? ''
  console.log('buvid3:', buvid3 ? `${buvid3.slice(0, 12)}…` : '(空)')
} catch (e) {
  console.log('buvid3 获取失败:', e.message)
}

const cases = [
  ['view BV1GJ411x7h7', '/x/web-interface/view', { bvid: 'BV1GJ411x7h7' }],
  ['view BV1xx411c7mD', '/x/web-interface/view', { bvid: 'BV1xx411c7mD' }],
  ['view aid=2', '/x/web-interface/view', { aid: 2 }],
  ['popular', '/x/web-interface/popular', { ps: 5, pn: 1 }],
  ['search', '/x/web-interface/search/all/v2', { keyword: '猫', page: 1 }],
  ['card', '/x/web-interface/card', { mid: 546195 }],
  ['relation/stat', '/x/relation/stat', { vmid: 546195 }],
  ['archive/desc', '/x/web-interface/archive/desc', { bvid: 'BV1GJ411x7h7' }],
]

for (const [label, path, params] of cases) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
  const url = `https://api.bilibili.com${path}?${qs}`
  for (const mode of ['无cookie', '带buvid3']) {
    const headers = { 'User-Agent': UA, Referer: 'https://www.bilibili.com/', Accept: 'application/json' }
    if (mode === '带buvid3' && buvid3) headers.Cookie = `buvid3=${buvid3}`
    try {
      const res = await fetch(url, { headers })
      const text = await res.text()
      const kind = text.trimStart().startsWith('<') ? 'HTML' : 'JSON'
      let code = '-'
      try { code = JSON.parse(text).code } catch { /* HTML */ }
      console.log(`${label.padEnd(20)} ${mode.padEnd(10)} HTTP ${res.status} ${kind} code=${code}`)
    } catch (e) {
      console.log(`${label.padEnd(20)} ${mode.padEnd(10)} 异常 ${e.message}`)
    }
    await new Promise((r) => setTimeout(r, 800))
  }
}

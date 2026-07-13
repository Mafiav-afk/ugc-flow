export const VIDEO_MODEL_PROFILES = [
  { id: 'veo3.1-quality', label: 'Veo 3.1 Quality（8秒 · 有声）', match: /^veo3(?:\.1)?[-_.]?quality$/i, audio: true, durations: ['8'], resolutions: ['720x1280','1280x720'], ratios: ['9:16','16:9'] },
  { id: 'veo3.1-official', label: 'Veo 3.1 Official（8秒 · 有声）', match: /^veo3(?:\.1)?[-_.]?(?:quality|fast)[-_.]?official$/i, audio: true, durations: ['8'], resolutions: ['720x1280','1280x720'], ratios: ['9:16','16:9'] },
  { id: 'grok-video-3', label: 'Grok Video 3（ToAPIs 官方支持）', match: /^grok-video-3$/i, requiresImage: false, audio: false, durations: ['10','15'], resolutions: ['720P','1080P'], ratios: ['16:9','9:16'] },
  { id: 'grok-video-1.5-preview', label: 'Grok Video 1.5 Preview（中转别名）', match: /^grok-video-1\.5-preview$/i, requiresImage: true, audio: true, durations: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'], resolutions: ['720p','480p'], ratios: ['16:9','9:16','1:1','3:2','2:3'] },
  { id: 'grok-imagine-video-1.5-preview', label: 'Grok Imagine Video 1.5（xAI 官方/预览别名）', match: /^grok-imagine-video-1\.5(?:-preview)?$/i, requiresImage: true, audio: false, durations: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'], resolutions: ['720p','480p','1080p'], ratios: ['16:9','9:16','1:1','3:2','2:3'] },
  { id: 'sora-2', label: 'Sora 2（接口未声明音频开关）', match: /sora/i, audio: false, durations: ['4','8','12'], resolutions: ['720x1280','1280x720'], ratios: ['9:16','16:9'] },
  { id: 'gemini_omni_flash', label: 'Gemini Omni Flash（6/10秒）', match: /gemini[_-]omni[_-]flash/i, audio: false, durations: ['6','10'], resolutions: ['720P'], ratios: ['16:9','9:16'] },
  { id: 'viduq3-pro', label: 'Vidu Q3 Pro（有声）', match: /vidu.*q3/i, audio: true, durations: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16'], resolutions: ['540p','720p','1080p'], ratios: ['9:16','16:9','1:1'] },
  { id: 'kwvideo-v2-ref', label: 'Seedance / 即梦参考生（有声）', match: /(?:kwvideo|seedance|jimeng)/i, audio: true, durations: ['auto','4','5','6','7','8','9','10','11','12'], resolutions: ['480p','720p','1080p','4K'], ratios: ['adaptive','9:16','16:9','4:3','1:1','3:4','21:9'], modes: ['快速','标准','Mini'] },
  { id: 'happyhorse-1.1-t2v', label: 'HappyHorse 文生视频', match: /happyhorse/i, durations: ['3','4','5','6','7','8','9','10','11','12','13','14','15'], resolutions: ['720P','1080P'], ratios: ['9:16','16:9','1:1','4:3','3:4','4:5','5:4','9:21','21:9'] },
  { id: 'kling-video-o1', label: 'Kling Video O1', match: /kling[-_.]?video[-_.]?o1/i, durations: ['5','10'], resolutions: ['720p','1080p'], ratios: ['9:16','16:9','1:1'], modes: ['std','pro'] },
  { id: 'kling-v3-video', label: 'Kling V3 Video', match: /kling/i, durations: ['5','10','15'], resolutions: ['720p','1080p'], ratios: ['9:16','16:9','1:1'], modes: ['std','pro'] },
  { id: 'minimax-hailuo', label: 'MiniMax Hailuo', match: /(?:minimax[-_.]?)?hailuo/i, durations: ['6','10'], resolutions: ['768P','1080P'], ratios: ['9:16','16:9'] },
  { id: 'wan2.7-cankaosheng', label: 'Wan / 万相参考生（有声）', match: /wan(?:2|x)?[.-]?\d|wanxiang/i, audio: true, durations: ['5','10','15'], resolutions: ['720p','1080p'], ratios: ['9:16','16:9','1:1','4:3','3:4'] },
]

export const GENERIC_VIDEO_PROFILE = { id: 'custom', label: '自定义视频模型', match: /.*/, durations: ['5','10','15'], resolutions: ['720p','1080p'], ratios: ['9:16','16:9','1:1'], modes: [] }

export function getVideoModelProfile(model) {
  return VIDEO_MODEL_PROFILES.find((profile) => profile.match.test(String(model || ''))) || GENERIC_VIDEO_PROFILE
}

export function normalizeVideoSelection(profile, selection = {}) {
  if (profile.id === 'custom') return {
    duration: String(selection.duration || profile.durations[0]),
    resolution: String(selection.resolution || profile.resolutions[0]),
    aspectRatio: String(selection.aspectRatio || profile.ratios[0]),
    mode: String(selection.mode || ''),
  }
  let mode = profile.modes?.includes(selection.mode) ? selection.mode : profile.modes?.[0] || ''
  let resolution = profile.resolutions.includes(selection.resolution) ? selection.resolution : profile.resolutions[0]
  if (/(?:kwvideo|seedance|jimeng)/i.test(profile.id) && ['1080p','4K'].includes(resolution)) mode = '标准'
  return {
    duration: profile.durations.includes(String(selection.duration)) ? String(selection.duration) : profile.durations[0],
    resolution,
    aspectRatio: profile.ratios.includes(selection.aspectRatio) ? selection.aspectRatio : profile.ratios[0],
    mode,
  }
}

export function videoSelectionParams(model, selection = {}, profileOverride = '') {
  const profile = profileOverride === 'custom' ? GENERIC_VIDEO_PROFILE : profileOverride ? getVideoModelProfile(profileOverride) : getVideoModelProfile(model)
  const normalized = normalizeVideoSelection(profile, selection)
  const id = String(profileOverride === 'custom' ? 'custom' : profileOverride || model || '').toLowerCase()
  if (/sora|veo3/i.test(id)) return { duration: normalized.duration, seconds: normalized.duration, size: normalized.resolution, aspect_ratio: normalized.aspectRatio, orientation: normalized.aspectRatio === '9:16' ? 'portrait' : 'landscape' }
  if (/happyhorse/i.test(id)) return { duration: normalized.duration, resolution: normalized.resolution, ratio: normalized.aspectRatio }
  if (/(?:kwvideo|seedance|jimeng)/i.test(id)) return { duration: normalized.duration, resolution: normalized.resolution, aspect_ratio: normalized.aspectRatio, version: normalized.mode }
  if (/kling/i.test(id)) return { duration: normalized.duration, resolution: normalized.resolution, aspect_ratio: normalized.aspectRatio, mode: normalized.mode }
  if (/wan(?:2|x)?[.-]?\d|wanxiang/i.test(id)) return { duration: normalized.duration, resolution: normalized.resolution, ratio: normalized.aspectRatio }
  return { duration: normalized.duration, resolution: normalized.resolution, aspect_ratio: normalized.aspectRatio, ...(normalized.mode ? { mode: normalized.mode } : {}) }
}

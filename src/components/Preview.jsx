import { Copy, Download, FileJson, Maximize, Pause, Play, Volume2, WandSparkles } from 'lucide-react'
import { DEFAULT_SHOTS } from '../constants'
import { downloadJson } from '../lib/client'
import { useState } from 'react'

const clock = (seconds) => `00:${String(Math.max(0, Math.round(seconds || 0))).padStart(2, '0')}`

export function Preview({ job, notify }) {
  const [mediaDuration, setMediaDuration] = useState(0)
  const result = job?.result
  const image = result?.previewUrl || result?.characterUrl || `${import.meta.env.BASE_URL}assets/demo-ugc-frame.png`
  async function copyPrompt() { if (!result?.prompt) return; await navigator.clipboard.writeText(result.prompt); notify('视频提示词已复制') }
  function exportProject() { if (!result) return; downloadJson(`ugc-flow-${Date.now()}.json`, { generatedAt: new Date().toISOString(), result }) }
  return <section className="preview panel"><div className="section-title">成片预览 <small>9:16</small></div><div className="preview-body">
    <div className="phone-frame">{result?.videoUrl ? <video controls src={result.videoUrl} onLoadedMetadata={(event) => setMediaDuration(event.currentTarget.duration || 0)}/> : <img src={image} alt="UGC 成片预览"/>}<span className="ratio-tag">9:16</span><span className="caption">{result?.strategy?.hook || '清爽不油腻\n防晒超给力'}</span>{job?.status === 'running' ? <span className="preview-status">生成中</span> : null}</div>
    <div className="player"><button aria-label="播放预览" disabled={!result?.videoUrl}>{result?.videoUrl ? <Pause size={16}/> : <Play size={16} fill="currentColor"/>}</button><span>{result?.videoUrl && mediaDuration ? `${clock(mediaDuration)} / ${clock(mediaDuration)}` : '00:15 / 00:28'}</span><i><b style={{ width: job?.status === 'completed' ? '100%' : job?.status === 'running' ? `${Math.max(12, (job.stage / 6) * 100)}%` : '38%' }}/></i><Volume2 size={15}/><Maximize size={15}/></div>
    {result ? <div className="preview-actions"><button onClick={copyPrompt}><Copy size={13}/>复制提示词</button><button onClick={exportProject}><FileJson size={13}/>导出项目</button>{result.videoUrl ? <a href={result.videoUrl} download><Download size={13}/>下载成片</a> : null}</div> : null}
  </div></section>
}

export function ShotsPanel({ job, onEditShots }) {
  const result = job?.result, shots = result?.strategy?.shots || DEFAULT_SHOTS
  const image = result?.previewUrl || result?.characterUrl || `${import.meta.env.BASE_URL}assets/demo-ugc-frame.png`
  const activeIndex = job?.status === 'running' ? Math.min(7, Math.max(0, (job.stage || 1) - 1)) : 4
  return <section className="shots-panel panel"><div className="section-title">8 镜头脚本</div><div className="shot-cards">{shots.map((shot, index) => <button className={`shot-card ${index === activeIndex ? 'active' : ''}`} key={`${index}-${shot}`} onClick={() => onEditShots(shots)}>{index === activeIndex ? <Play className="shot-active-marker" size={13} fill="currentColor"/> : null}<b>{index + 1}</b><img src={image} alt="" style={{ objectPosition: `${35 + (index % 3) * 15}% ${20 + (index % 4) * 18}%` }}/><span><strong>{index + 1}&nbsp; {shot.split('：')[0]}</strong><small>{index === 7 ? '00:03' : index % 3 === 2 ? '00:04' : '00:03'}</small></span></button>)}</div><button className="script-detail" onClick={() => onEditShots(shots)}><FileJson size={15}/>脚本详情</button></section>
}

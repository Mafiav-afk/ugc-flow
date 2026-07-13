import { Check, Code2, Download, Link2, LoaderCircle, Rocket } from 'lucide-react'
import { useState } from 'react'
import { desktopDownloadUrl } from '../lib/client'

function Step({ number, title, copy, children }) {
  return <div className="setup-step"><span className="setup-number">{number}</span><div className="setup-copy"><strong>{title}</strong><small>{copy}</small></div>{children}</div>
}

export function DeployBar({ deploy, deploying, agents, config, serviceReady, connecting, onConnect }) {
  const [target, setTarget] = useState(config.agentProvider || 'codex')
  const agent = agents?.[target]
  const mediaReady = config.demoMode || Boolean((config.videoBaseUrl || config.baseUrl) && (config.videoApiKey || config.apiKey))
  return <section className="deploy-bar" id="deploy-section" aria-label="本地安装与自动连接">
    <Step number="1" title="下载 Mac 版" copy="Apple Silicon · 本地运行">
      <a className="setup-action download-action" href={desktopDownloadUrl} download><Download size={15}/>下载 Mac 版</a>
    </Step>
    <Step number="2" title="自动连接" copy="检测本地智能体与媒体接口">
      <div className="connection-summary" aria-label="连接状态">
        <span className={agent?.authenticated ? 'ready' : ''}><i/>{target === 'claude' ? 'Claude' : 'Codex'} {agent?.authenticated ? '已连接' : '待连接'}</span>
        <span className={mediaReady ? 'ready' : ''}><i/>媒体 API {config.demoMode ? '演示模式' : mediaReady ? '已配置' : '待配置'}</span>
        <span className={serviceReady ? 'ready' : ''}><i/>本地服务{serviceReady ? '运行中' : '检测中'}</span>
      </div>
      <button className="reconnect-button" onClick={onConnect} disabled={connecting}>{connecting ? <LoaderCircle className="spin" size={14}/> : <Link2 size={14}/>}重新检测</button>
    </Step>
    <Step number="3" title="一键部署技能" copy="将 4 项 UGC 技能部署到本机">
      <div className="target-switch" role="group" aria-label="部署目标"><button className={target === 'codex' ? 'selected' : ''} onClick={() => setTarget('codex')}><Code2 size={15}/>Codex</button><button className={target === 'claude' ? 'selected' : ''} onClick={() => setTarget('claude')}><span>AI</span>Claude</button></div>
      <button className="deploy-button" disabled={deploying} onClick={() => deploy(target)}>{deploying ? <LoaderCircle className="spin" size={15}/> : agent?.authenticated ? <Check size={15}/> : <Rocket size={15}/>} {deploying ? '正在部署…' : '一键部署技能'}</button>
    </Step>
  </section>
}

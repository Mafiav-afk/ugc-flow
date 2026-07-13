import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bell, Box, CircleHelp, FileText, LayoutGrid, Link, Monitor, Square, UserCircle, WandSparkles, X } from 'lucide-react'
import { INITIAL_BRIEF, INITIAL_CONFIG } from './constants'
import { api, wait } from './lib/client'
import { serializableBrief, useStoredState } from './lib/storage'
import { userErrorMessage } from './lib/user-error'
import { getVideoModelProfile } from '../shared/video-models.mjs'
import { Sidebar } from './components/Sidebar'
import { ProductForm } from './components/ProductForm'
import { Workflow } from './components/Workflow'
import { Preview, ShotsPanel } from './components/Preview'
import { ApiModal } from './components/ApiModal'
import { DeployBar } from './components/DeployBar'
import { SidePanel } from './components/SidePanel'
import { ScriptModal } from './components/ScriptModal'
import './styles.css'

function App() {
  const [brief, setBrief] = useStoredState('ugc-flow:draft', INITIAL_BRIEF)
  const [projects, setProjects] = useStoredState('ugc-flow:projects', [])
  const [config, setConfig] = useStoredState('ugc-flow:config', INITIAL_CONFIG, sessionStorage)
  const [activeView, setActiveView] = useState('workspace')
  const [showApi, setShowApi] = useState(false)
  const [scriptShots, setScriptShots] = useState(null)
  const [notice, setNotice] = useState(null)
  const [job, setJob] = useState(null)
  const [testing, setTesting] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [agents, setAgents] = useState(null)
  const [serviceReady, setServiceReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const runToken = useRef(0)
  const currentJobId = useRef(null)

  const selectedAgent = agents?.[config.agentProvider]
  const ready = config.demoMode || Boolean(selectedAgent?.authenticated && (config.videoBaseUrl || config.baseUrl) && (config.videoApiKey || config.apiKey) && (['reference', 'agent'].includes(config.imageSource) || ((config.imageBaseUrl || config.baseUrl) && (config.imageApiKey || config.apiKey))))
  const running = ['queued', 'running'].includes(job?.status)
  useEffect(() => {
    api.health().then(() => setServiceReady(true)).catch(() => setServiceReady(false))
    api.agents().then(setAgents).catch(() => setAgents({}))
  }, [])
  function notify(message, tone = 'success') { setNotice({ message: tone === 'error' ? userErrorMessage(message) : message, tone }) }
  function navigate(view) {
    if (view === 'api') { setShowApi(true); setActiveView('workspace'); return }
    if (view === 'deploy') { setActiveView('workspace'); requestAnimationFrame(() => document.getElementById('deploy-section')?.scrollIntoView({ behavior: 'smooth', block: 'end' })); return }
    if (view === 'help') { notify('操作顺序：填写商品信息 → 选择演示或真实 API → 一键生成 → 导出结果'); return }
    setActiveView(view)
  }
  function persistProject(completedJob) {
    const id = crypto.randomUUID(), now = new Date().toISOString()
    const project = { id, name: brief.name || '未命名项目', brief: serializableBrief(brief), result: completedJob.result, updatedAt: now }
    setProjects((current) => [project, ...current].slice(0, 30))
  }
  async function pollJob(id, token) {
    while (runToken.current === token) {
      const next = await api.getJob(id)
      setJob(next)
      if (next.status === 'completed') { persistProject(next); notify(next.result.mode === 'demo' ? '演示工作流已完整跑通' : '带货视频生成完成'); return }
      if (next.status === 'failed') { notify(next.error || next.message, 'error'); return }
      if (next.status === 'cancelled') { notify('任务已取消', 'info'); return }
      await wait(next.status === 'running' ? 250 : 400)
    }
  }
  async function run() {
    if (!brief.name.trim() || !brief.sellingPoints.trim()) { notify('请先填写产品名称和核心卖点', 'error'); return }
    if (!ready) { setShowApi(true); return }
    const videoModel = String(config.videoModels || config.videoModel || '').split(/[\n,，]/).map((item) => item.trim()).find(Boolean)
    const videoProfile = getVideoModelProfile(videoModel)
    if (!config.demoMode && videoProfile.requiresImage && config.videoReferencePolicy === 'text-only') { notify(`${videoModel} 仅支持图生视频，不能使用“始终文生视频”。请改为强制参考图或选择文生视频模型。`, 'error'); setShowApi(true); return }
    if (!config.demoMode && videoProfile.requiresImage && config.imageSource === 'reference' && !(brief.assets || []).length && !config.videoReferenceUrl) { notify(`${videoModel} 需要 1 张参考图。请先上传图片或填写公网图片 URL。`, 'error'); return }
    const token = ++runToken.current
    setJob({ status: 'queued', stage: 0, message: '正在创建任务', logs: [] })
    try { const created = await api.createJob(brief, config); currentJobId.current = created.id; setJob(created); await pollJob(created.id, token) }
    catch (error) { setJob((current) => ({ ...current, status: 'failed', error: error.message, message: error.message })); notify(error.message, 'error') }
  }
  async function cancel() {
    runToken.current += 1
    if (currentJobId.current) { const cancelled = await api.cancelJob(currentJobId.current); setJob(cancelled) }
  }
  async function testApi() { setTesting(true); try { const discovered = await api.discover(config); const nextConfig = discovered.config || config; setConfig(nextConfig); const result = await api.test(nextConfig); if (result.resolvedConfig) setConfig(result.resolvedConfig); notify(result.message) } catch (error) { notify(error.message, 'error') } finally { setTesting(false) } }
  async function loadModels() {
    setLoadingModels(true)
    try {
      const discovered = await api.discover(config), nextConfig = discovered.config || config
      const result = await api.models(nextConfig)
      setConfig((current) => ({ ...current, ...(result.resolvedConfig || nextConfig), ...(result.image.length ? { imageModels: result.image.slice(0, 12).join(', ') } : {}), ...(result.video.length ? { videoModels: result.video.slice(0, 12).join(', ') } : {}) }))
      notify(`已读取 ${result.all.length} 个模型：图片 ${result.image.length}、视频 ${result.video.length}`)
    } catch (error) { notify(error.message, 'error') } finally { setLoadingModels(false) }
  }
  async function deploy(target) { setDeploying(true); try { const result = await api.deploy(target); notify(result.message) } catch (error) { notify(error.message, 'error') } finally { setDeploying(false) } }
  async function connectLocal() {
    setConnecting(true)
    try {
      const [health, nextAgents] = await Promise.all([api.health(), api.agents()])
      setServiceReady(Boolean(health.ok)); setAgents(nextAgents)
      if (!config.demoMode && (config.videoBaseUrl || config.baseUrl) && (config.videoApiKey || config.apiKey)) {
        const result = await api.test(config)
        if (result.resolvedConfig) setConfig(result.resolvedConfig)
        notify(result.message)
      } else notify(config.demoMode ? '本地服务与智能体检测完成；当前为演示模式' : '本地服务检测完成；配置媒体 API 后可自动测试连接')
    } catch (error) { notify(error.message, 'error') } finally { setConnecting(false) }
  }
  function loadProject(project) { setBrief({ ...INITIAL_BRIEF, ...project.brief, assets: [] }); setJob(project.result ? { status: 'completed', stage: 6, message: '已加载历史项目', result: project.result, logs: [] } : null); setActiveView('workspace'); notify(`已加载：${project.name}`) }
  function useTemplate(template) { setBrief((current) => ({ ...current, ...template.brief, assets: [] })); setActiveView('workspace'); notify(`已应用模板：${template.name}`) }
  function saveShots(shots) { setJob((current) => ({ ...current, result: { ...current.result, strategy: { ...current.result.strategy, shots } } })); setScriptShots(null); notify('镜头脚本已更新') }

  const topItems = [['workspace', Monitor, '工作台'], ['projects', FileText, '项目'], ['templates', LayoutGrid, '模板'], ['api', Link, 'API 接入'], ['deploy', Box, '部署']]
  return <div className="app"><Sidebar activeView={activeView} onNavigate={navigate}/><main><header><nav className="top-navigation">{topItems.map(([id, Icon, label]) => <button key={id} className={activeView === id || (id === 'workspace' && !['projects','templates'].includes(activeView)) ? 'active' : ''} onClick={() => navigate(id)}><Icon size={17}/>{label}</button>)}</nav><div className="header-actions"><button className="generate" onClick={run} disabled={running}><WandSparkles size={18}/>一键生成带货视频</button><button className="header-icon" aria-label="通知"><Bell size={18}/></button><button className="header-icon" aria-label="帮助中心" onClick={() => navigate('help')}><CircleHelp size={18}/></button><button className="header-icon" aria-label="账户"><UserCircle size={21}/></button></div></header>
    <div className="workspace"><ProductForm brief={brief} setBrief={setBrief} notify={notify}/><Workflow job={job} onRetry={run}/><Preview job={job} notify={notify}/><ShotsPanel job={job} onEditShots={setScriptShots}/></div><DeployBar deploy={deploy} deploying={deploying} agents={agents} config={config} serviceReady={serviceReady} connecting={connecting} onConnect={connectLocal}/></main>
    <SidePanel view={activeView} projects={projects} onClose={() => setActiveView('workspace')} onLoadProject={loadProject} onDeleteProject={(id) => setProjects((current) => current.filter((item) => item.id !== id))} onUseTemplate={useTemplate}/>
    {showApi ? <ApiModal config={config} setConfig={setConfig} agents={agents} refreshAgents={() => api.agents().then(setAgents)} close={() => setShowApi(false)} testApi={testApi} testing={testing} loadModels={loadModels} loadingModels={loadingModels}/> : null}
    {scriptShots ? <ScriptModal initialShots={scriptShots} onClose={() => setScriptShots(null)} onSave={saveShots}/> : null}
    {notice ? <button className={`toast ${notice.tone}`} onClick={() => setNotice(null)}>{notice.message}<X size={14}/></button> : null}
  </div>
}

const rootElement = document.getElementById('root')
const root = rootElement.__ugcFlowRoot || createRoot(rootElement)
rootElement.__ugcFlowRoot = root
root.render(<App/>)

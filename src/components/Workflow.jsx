import { Check, CircleX, RotateCcw } from 'lucide-react'
import { STAGES } from '../constants'

export function Workflow({ job, onRetry }) {
  const current = job?.stage || 0, terminal = ['completed', 'failed', 'cancelled'].includes(job?.status)
  const status = job?.status === 'running' ? '工作流运行中' : job?.status === 'completed' ? '已完成' : job?.status === 'failed' ? '执行失败' : job?.status === 'cancelled' ? '已取消' : '等待启动'
  return <section className="workflow panel"><div className="section-title">自动化工作流 <small className={`job-status ${job?.status || 'idle'}`}>{status}</small></div><div className="workflow-body">
    {STAGES.map(([title, desc, Icon], index) => {
      const number = index + 1, done = job?.status === 'completed' || number < current, active = job?.status === 'running' && number === current, failed = job?.status === 'failed' && number === current
      const progress = number === 5 ? 68 : Math.min(88, 56 + current * 6)
      return <div className={`stage ${done ? 'done' : ''} ${active ? 'active' : ''} ${failed ? 'failed' : ''}`} key={title}>
        <div className="rail"><span className="stage-number">{done ? <Check size={14}/> : failed ? <CircleX size={14}/> : number}</span></div>
        <div className="stage-card"><div className="stage-icon"><Icon size={19}/></div><div className="stage-copy"><strong>{number}&nbsp; {title}</strong>{done ? <><small className="stage-state">已完成</small><small>{desc}</small></> : <small>{active || failed ? job.message : desc}</small>}</div>{done && number < 5 ? <button type="button">查看</button> : null}{active ? <div className="stage-progress"><span><i style={{ width: `${progress}%` }}/></span><b>{progress}%</b><small>当前步骤：生成镜头 {Math.min(8, Math.max(1, current))}/8</small></div> : null}</div>
      </div>
    })}
    {terminal && job?.status !== 'completed' ? <button className="retry-button" onClick={onRetry}><RotateCcw size={15}/>重新执行任务</button> : null}
    {job?.logs?.length ? <details className="job-logs"><summary>查看运行日志（{job.logs.length}）</summary>{job.logs.map((item, index) => <p key={`${item.at}-${index}`}><span>{item.stage}/6</span>{item.message}</p>)}</details> : null}
  </div></section>
}

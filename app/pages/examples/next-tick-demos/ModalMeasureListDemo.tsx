import { type FC, nextTick, ref, useRef } from '@rue-js/rue'

type Recipient = {
  id: number
  name: string
  team: string
  region: string
}

const defaultLogs = [
  '1. 打开批量发送弹窗',
  '2. 同步阶段列表容器还没真正挂载完成',
  '3. await nextTick() 后再测量列表高度决定布局策略',
]

const recipients: Recipient[] = [
  { id: 1, name: '李婷', team: '华东销售', region: '上海' },
  { id: 2, name: '周扬', team: '华东销售', region: '杭州' },
  { id: 3, name: '张一鸣', team: '华南渠道', region: '深圳' },
  { id: 4, name: '赵琪', team: '华南渠道', region: '广州' },
  { id: 5, name: '孙旭', team: '风控运营', region: '北京' },
  { id: 6, name: '陈尧', team: '风控运营', region: '天津' },
  { id: 7, name: '王蔓', team: '售后支持', region: '苏州' },
  { id: 8, name: '杨柳', team: '售后支持', region: '南京' },
  { id: 9, name: '蒋可', team: '仓储计划', region: '武汉' },
  { id: 10, name: '高晴', team: '仓储计划', region: '成都' },
]

const ModalMeasureListDemo: FC = () => {
  const modalOpen = ref(false)
  const syncHeight = ref('尚未打开')
  const postTickHeight = ref('尚未测量')
  const layoutDecision = ref('等待测量')
  const logLines = ref<string[]>([...defaultLogs])
  const listRef = useRef<HTMLDivElement>()

  const openModal = async () => {
    modalOpen.value = true

    const currentHeight = listRef.current?.scrollHeight ?? 0
    syncHeight.value = `${currentHeight}px`
    postTickHeight.value = '等待 flush...'
    layoutDecision.value = '等待布局完成...'
    logLines.value = [
      `弹窗准备渲染 ${recipients.length} 个接收人`,
      `同步读取列表高度：${currentHeight}px`,
      '等待 nextTick() 后决定是否启用内部滚动...',
    ]

    await nextTick()

    const nextHeight = listRef.current?.scrollHeight ?? 0
    postTickHeight.value = `${nextHeight}px`
    layoutDecision.value =
      nextHeight > 280
        ? '列表超过阈值，建议固定 320px 高度并启用内部滚动'
        : '列表高度可控，可以直接完整展示'
    logLines.value = [
      `弹窗准备渲染 ${recipients.length} 个接收人`,
      `同步读取列表高度：${currentHeight}px`,
      `nextTick() 后列表高度：${nextHeight}px，${layoutDecision.value}`,
    ]
  }

  const closeModal = () => {
    modalOpen.value = false
    syncHeight.value = '尚未打开'
    postTickHeight.value = '尚未测量'
    layoutDecision.value = '等待测量'
    logLines.value = [...defaultLogs]
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body gap-5">
        <p className="text-base-content/70 leading-7">
          营销、消息中心、批量通知类弹窗经常要在打开后测量接收人列表的高度，决定是直接展开还是切换成固定高度滚动容器。弹窗内容本身是新挂载的，必须等
          nextTick() 后再测量。
        </p>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => void openModal()}>
            打开批量发送弹窗
          </button>
          <button className="btn btn-ghost" onClick={closeModal}>
            关闭并重置
          </button>
        </div>

        {modalOpen.value && (
          <div className="rounded-box border border-base-300 bg-base-100 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-base-content/50">
                  批量发送预览
                </div>
                <div className="mt-2 text-2xl font-semibold">确认接收人列表</div>
              </div>
              <div className="badge badge-outline">{recipients.length} 人</div>
            </div>

            <div ref={listRef} className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-2">
              {recipients.map(person => (
                <div key={person.id} className="rounded-box bg-base-200/70 p-3 text-sm leading-6">
                  <div className="font-medium">{person.name}</div>
                  <div className="text-base-content/60">
                    {person.team} · {person.region}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">同步读取到的高度</div>
            <div className="mt-2 font-mono text-xl">{syncHeight.value}</div>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">await nextTick() 后高度</div>
            <div className="mt-2 font-mono text-xl text-success">{postTickHeight.value}</div>
          </div>
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <div className="text-sm text-base-content/60">布局决策</div>
            <div className="mt-2 text-sm leading-6 text-base-content/80">
              {layoutDecision.value}
            </div>
          </div>
        </div>

        <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-4">
          <div className="text-sm font-medium text-base-content/70">本轮步骤</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/80">
            {logLines.value.map((line, index) => (
              <li key={`modal-measure-log-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ModalMeasureListDemo

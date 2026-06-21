import { type FC, Teleport, Transition, ref } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const modalStyles = `
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.45);
}

.modal-container {
  width: min(100%, 28rem);
  border-radius: 1rem;
  background: #fff;
  padding: 1.5rem;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
}

.modal-header h3 {
  margin: 0;
  color: #0f172a;
}

.modal-body {
  margin: 1rem 0 1.25rem;
  color: #475569;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}

.modal-default-button {
  padding: 0.5rem 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  cursor: pointer;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 300ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 300ms ease, opacity 300ms ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(16px) scale(0.96);
  opacity: 0;
}
`

const modalSource = `import { type FC, Teleport, Transition, ref } from '@rue-js/rue';

const modalStyles = \`
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.45);
}

.modal-container {
  width: min(100%, 28rem);
  border-radius: 1rem;
  background: #fff;
  padding: 1.5rem;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
}

.modal-header h3 {
  margin: 0;
  color: #0f172a;
}

.modal-body {
  margin: 1rem 0 1.25rem;
  color: #475569;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
}

.modal-default-button {
  padding: 0.5rem 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #ffffff;
  cursor: pointer;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 300ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 300ms ease, opacity 300ms ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(16px) scale(0.96);
  opacity: 0;
}
\`;

const Modal: FC<{ visible: boolean; onClose?: () => void }> = (props) => (
  <Teleport to="body">
    <>
      <style>{modalStyles}</style>
      <Transition name="modal" type="transition" duration={300} appear>
        {props.visible ? (
          <div className="modal-mask" onClick={() => props.onClose && props.onClose()}>
            <div className="modal-container" onClick={(event: any) => event.stopPropagation()}>
              <div className="modal-header">
                <h3>Custom Header</h3>
              </div>
              <div className="modal-body">
                <p>Custom body content is rendered inside the transitioned modal.</p>
              </div>
              <div className="modal-footer">
                <button className="modal-default-button" onClick={() => props.onClose && props.onClose()}>
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Transition>
    </>
  </Teleport>
);

const ensureLateTarget = (shellId: string, targetId: string) => {
  if (typeof document === 'undefined') return;
  const shell = document.getElementById(shellId);
  if (!shell || document.getElementById(targetId)) return;
  const target = document.createElement('div');
  target.id = targetId;
  target.className = 'mt-3 min-h-16 rounded-box border border-dashed border-info/50 bg-base-100 p-3';
  target.textContent = 'late target created';
  shell.appendChild(target);
};

const clearLateTargetShell = (shellId: string) => {
  if (typeof document === 'undefined') return;
  document.getElementById(shellId)?.replaceChildren();
};

const LateTargetHost: FC<{ shellId: string; label: string }> = (props) => {
  return (
    <div className="mt-3 rounded-box border border-base-300 bg-base-100 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">{props.label}</div>
      <div id={props.shellId} />
    </div>
  );
};

const ModalExample: FC = () => {
  const visibleModal = ref(false);
  const normalRun = ref(0);
  const normalActive = ref(false);
  const deferRun = ref(0);
  const normalTargetId = 'modal-normal-late-target-' + normalRun.value;
  const deferTargetId = 'modal-defer-late-target-' + deferRun.value;

  if (normalRun.value > 0) {
    queueMicrotask(() => ensureLateTarget('modal-normal-late-shell', normalTargetId));
  }
  if (deferRun.value > 0) {
    queueMicrotask(() => ensureLateTarget('modal-defer-late-shell', deferTargetId));
  }

  return (
    <div className="grid gap-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body grid gap-4">
          <button id="visible-modal" className="btn btn-primary w-fit" onClick={() => (visibleModal.value = true)}>
            Visible Modal
          </button>
          <Modal visible={visibleModal.value} onClose={() => (visibleModal.value = false)} />
        </div>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body grid gap-4">
          <div>
            <h2 className="card-title text-xl">Teleport defer 对照</h2>
            <p className="text-sm text-base-content/70">
              目标在同一轮更新末尾才出现：普通 Teleport 查找一次后结束，defer 会在微任务里再查找。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-box border border-base-300 p-4">
              <div className="font-medium">不使用 defer</div>
              <button
                id="run-normal-teleport"
                className="btn btn-outline btn-sm mt-3"
                onClick={() => {
                  const nextRun = normalRun.value + 1;
                  clearLateTargetShell('modal-normal-late-shell');
                  normalActive.value = true;
                  queueMicrotask(() =>
                    ensureLateTarget('modal-normal-late-shell', 'modal-normal-late-target-' + nextRun),
                  );
                  queueMicrotask(() => {
                    normalActive.value = false;
                  });
                  normalRun.value = nextRun;
                }}
              >
                Run normal
              </button>
              {normalRun.value > 0 ? (
                <p className="mt-2 text-xs text-base-content/60">
                  target 已晚到；普通 Teleport 没有再次解析。
                </p>
              ) : null}
              {normalActive.value && normalRun.value > 0 ? (
                <Teleport to={'#' + normalTargetId}>
                  <div className="alert alert-warning mt-3 py-3">Normal payload</div>
                </Teleport>
              ) : null}
              <LateTargetHost shellId="modal-normal-late-shell" label="late target" />
            </section>
            <section className="rounded-box border border-info/40 p-4">
              <div className="font-medium">使用 defer</div>
              <button
                id="run-defer-teleport"
                className="btn btn-primary btn-sm mt-3"
                onClick={() => {
                  const nextRun = deferRun.value + 1;
                  clearLateTargetShell('modal-defer-late-shell');
                  queueMicrotask(() =>
                    ensureLateTarget('modal-defer-late-shell', 'modal-defer-late-target-' + nextRun),
                  );
                  deferRun.value = nextRun;
                }}
              >
                Run defer
              </button>
              {deferRun.value > 0 ? (
                <p className="mt-2 text-xs text-base-content/60">
                  target 晚到后，defer 重新解析并传送内容。
                </p>
              ) : null}
              {deferRun.value > 0 ? (
                <Teleport to={'#' + deferTargetId} defer>
                  <div className="alert alert-info mt-3 py-3">Deferred payload</div>
                </Teleport>
              ) : null}
              <LateTargetHost shellId="modal-defer-late-shell" label="late target" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalExample;`

const Modal: FC<{
  visible: boolean
  onClose?: () => void
}> = props => (
  <>
    <style>{modalStyles}</style>
    <Teleport to="body">
      <Transition name="modal" type="transition" duration={300} appear>
        {props.visible ? (
          <div
            className="modal-mask"
            onClick={() => {
              if (props.onClose) props.onClose()
            }}
          >
            <div
              className="modal-container"
              onClick={(event: any) => {
                event.stopPropagation()
              }}
            >
              <div className="modal-header">
                <h3>Custom Header</h3>
              </div>
              <div className="modal-body">
                <p>Custom body content is rendered inside the transitioned modal.</p>
              </div>
              <div className="modal-footer">
                <button
                  className="modal-default-button"
                  onClick={() => {
                    if (props.onClose) props.onClose()
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Transition>
    </Teleport>
  </>
)

const ensureLateTarget = (shellId: string, targetId: string) => {
  if (typeof document === 'undefined') return
  const shell = document.getElementById(shellId)
  if (!shell || document.getElementById(targetId)) return
  const target = document.createElement('div')
  target.id = targetId
  target.className = 'mt-3 min-h-16 rounded-box border border-dashed border-info/50 bg-base-100 p-3'
  target.textContent = 'late target created'
  shell.appendChild(target)
}

const clearLateTargetShell = (shellId: string) => {
  if (typeof document === 'undefined') return
  document.getElementById(shellId)?.replaceChildren()
}

const LateTargetHost: FC<{ shellId: string; label: string }> = props => {
  return (
    <div className="mt-3 rounded-box border border-base-300 bg-base-100 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">
        {props.label}
      </div>
      <div id={props.shellId} />
    </div>
  )
}

const ModalExample: FC = () => {
  const visibleModal = ref(false)
  const normalRun = ref(0)
  const normalActive = ref(false)
  const deferRun = ref(0)
  const activeTab = ref<'preview' | 'code'>('preview')
  const normalTargetId = 'modal-normal-late-target-' + normalRun.value
  const deferTargetId = 'modal-defer-late-target-' + deferRun.value

  if (normalRun.value > 0) {
    queueMicrotask(() => ensureLateTarget('modal-normal-late-shell', normalTargetId))
  }
  if (deferRun.value > 0) {
    queueMicrotask(() => ensureLateTarget('modal-defer-late-shell', deferTargetId))
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">带过渡动效的模态框（移植自 Vue）</h1>

      <div role="tablist" className="tabs tabs-box">
        <button
          role="tab"
          className={`tab ${activeTab.value === 'preview' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'preview'
          }}
        >
          效果
        </button>
        <button
          role="tab"
          className={`tab ${activeTab.value === 'code' ? 'tab-active' : ''}`}
          onClick={() => {
            activeTab.value = 'code'
          }}
        >
          代码
        </button>
      </div>

      <div className="mt-4 grid md:grid-cols-1 gap-6 items-start">
        {activeTab.value === 'code' && (
          <div className="card bg-base-100 shadow overflow-auto h-[360px] md:h-[560px]">
            <Code className="h-full" lang="tsx" code={modalSource} />
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="grid gap-6">
            <div className="card bg-base-100 shadow">
              <div className="card-body grid gap-4">
                <button
                  id="visible-modal"
                  className="btn btn-primary w-fit"
                  onClick={() => {
                    visibleModal.value = true
                  }}
                >
                  Visible Modal
                </button>
                <Modal
                  visible={visibleModal.value}
                  onClose={() => {
                    visibleModal.value = false
                  }}
                />
              </div>
            </div>
            <div className="card bg-base-100 shadow">
              <div className="card-body grid gap-4">
                <div>
                  <h2 className="card-title text-xl">Teleport defer 对照</h2>
                  <p className="text-sm text-base-content/70">
                    目标在同一轮更新末尾才出现：普通 Teleport 查找一次后结束，defer
                    会在微任务里再查找。
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-box border border-base-300 p-4">
                    <div className="font-medium">不使用 defer</div>
                    <button
                      id="run-normal-teleport"
                      className="btn btn-outline btn-sm mt-3"
                      onClick={() => {
                        const nextRun = normalRun.value + 1
                        clearLateTargetShell('modal-normal-late-shell')
                        normalActive.value = true
                        queueMicrotask(() =>
                          ensureLateTarget(
                            'modal-normal-late-shell',
                            'modal-normal-late-target-' + nextRun,
                          ),
                        )
                        queueMicrotask(() => {
                          normalActive.value = false
                        })
                        normalRun.value = nextRun
                      }}
                    >
                      Run normal
                    </button>
                    {normalRun.value > 0 ? (
                      <p className="mt-2 text-xs text-base-content/60">
                        target 已晚到；普通 Teleport 没有再次解析。
                      </p>
                    ) : null}
                    {normalActive.value && normalRun.value > 0 ? (
                      <Teleport to={'#' + normalTargetId}>
                        <div className="alert alert-warning mt-3 py-3">Normal payload</div>
                      </Teleport>
                    ) : null}
                    <LateTargetHost shellId="modal-normal-late-shell" label="late target" />
                  </section>
                  <section className="rounded-box border border-info/40 p-4">
                    <div className="font-medium">使用 defer</div>
                    <button
                      id="run-defer-teleport"
                      className="btn btn-primary btn-sm mt-3"
                      onClick={() => {
                        const nextRun = deferRun.value + 1
                        clearLateTargetShell('modal-defer-late-shell')
                        queueMicrotask(() =>
                          ensureLateTarget(
                            'modal-defer-late-shell',
                            'modal-defer-late-target-' + nextRun,
                          ),
                        )
                        deferRun.value = nextRun
                      }}
                    >
                      Run defer
                    </button>
                    {deferRun.value > 0 ? (
                      <p className="mt-2 text-xs text-base-content/60">
                        target 晚到后，defer 重新解析并传送内容。
                      </p>
                    ) : null}
                    {deferRun.value > 0 ? (
                      <Teleport to={'#' + deferTargetId} defer>
                        <div className="alert alert-info mt-3 py-3">Deferred payload</div>
                      </Teleport>
                    ) : null}
                    <LateTargetHost shellId="modal-defer-late-shell" label="late target" />
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default ModalExample

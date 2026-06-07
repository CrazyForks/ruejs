/**
 * triggerRef 示例页。
 *
 * 展示 shallowRef 内部对象原地修改后，通过 triggerRef 手动通知依赖更新。
 */
import { type FC, ref, shallowRef, triggerRef } from '@rue-js/rue'
import SidebarPlayground from '../site/SidebarPlaygroundExample'
import Code from '../site/components/Code'

const demoSource = `import { type FC, ref, shallowRef, triggerRef } from '@rue-js/rue';

const TriggerRefDemo: FC = () => {
  const profile = shallowRef({
    name: 'Rue',
    mood: 'calm',
    revisions: 0,
  });
  const note = ref('等待一次内部修改');

  const mutateSilently = () => {
    profile.value.revisions += 1;
    profile.value.mood = profile.value.mood === 'calm' ? 'focused' : 'calm';
    note.value = '对象内部已经变了，但浅层 ref 还没有触发视图更新';
  };

  const publishMutation = () => {
    triggerRef(profile);
    note.value = 'triggerRef(profile) 手动发布了这次内部变更';
  };

  const replaceProfile = () => {
    profile.value = {
      name: 'Rue',
      mood: 'refreshed',
      revisions: profile.value.revisions + 1,
    };
    note.value = '整体替换 profile.value 会自动触发更新';
  };

  return (
    <section className="space-y-4">
      <h2>{profile.value.name}</h2>
      <p>mood: {profile.value.mood}</p>
      <p>revisions: {profile.value.revisions}</p>
      <p>{note.value}</p>
      <button onClick={mutateSilently}>深层修改</button>
      <button onClick={publishMutation}>triggerRef</button>
      <button onClick={replaceProfile}>整体替换</button>
    </section>
  );
};

export default TriggerRefDemo;`

/** triggerRef 交互示例入口。 */
const TriggerRef: FC = () => {
  const profile = shallowRef({
    name: 'Rue',
    mood: 'calm',
    revisions: 0,
    log: ['ready'],
  })
  const note = ref('等待一次内部修改')
  const activeTab = ref<'preview' | 'code'>('preview')

  const mutateSilently = () => {
    profile.value.revisions += 1
    profile.value.mood = profile.value.mood === 'calm' ? 'focused' : 'calm'
    profile.value.log = [`draft #${profile.value.revisions}`, ...profile.value.log].slice(0, 4)
    note.value = '对象内部已经变了，但浅层 ref 还没有触发视图更新'
  }

  const publishMutation = () => {
    triggerRef(profile)
    note.value = 'triggerRef(profile) 手动发布了这次内部变更'
  }

  const replaceProfile = () => {
    profile.value = {
      name: 'Rue',
      mood: 'refreshed',
      revisions: profile.value.revisions + 1,
      log: [`replace #${profile.value.revisions + 1}`, ...profile.value.log].slice(0, 4),
    }
    note.value = '整体替换 profile.value 会自动触发更新'
  }

  return (
    <SidebarPlayground>
      <h1 className="text-5xl font-semibold mb-4 md:mb-4">triggerRef 手动触发浅层 ref</h1>
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
          <div className="card bg-base-100 shadow overflow-auto">
            <div className="card-body p-0">
              <Code className="h-full" lang="tsx" code={demoSource} />
            </div>
          </div>
        )}

        {activeTab.value === 'preview' && (
          <div className="card bg-base-100 shadow">
            <div className="card-body gap-5">
              <div className="flex flex-col gap-2">
                <div className="text-sm text-base-content/60">shallowRef profile</div>
                <div className="stats stats-vertical md:stats-horizontal bg-base-200">
                  <div className="stat">
                    <div className="stat-title">name</div>
                    <div className="stat-value text-2xl">{profile.value.name}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">mood</div>
                    <div className="stat-value text-2xl">{profile.value.mood}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">revisions</div>
                    <div className="stat-value text-2xl">{profile.value.revisions}</div>
                  </div>
                </div>
              </div>

              <div className="alert">
                <span>{note.value}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="btn btn-outline" onClick={mutateSilently}>
                  深层修改
                </button>
                <button className="btn btn-primary" onClick={publishMutation}>
                  triggerRef
                </button>
                <button className="btn" onClick={replaceProfile}>
                  整体替换
                </button>
              </div>

              <div className="rounded-box bg-base-200 p-4">
                <div className="text-sm font-medium mb-2">log</div>
                <div className="flex flex-wrap gap-2">
                  {profile.value.log.map(item => (
                    <span className="badge badge-neutral" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarPlayground>
  )
}

export default TriggerRef

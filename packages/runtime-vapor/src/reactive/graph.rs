//! Rue 增量响应式依赖图。
//!
//! # 与 alien-signals-rs 的关系
//!
//! 本文件参考了 MIT 许可的 `alien-signals-rs` 算法，但不是逐行拷贝，
//! 也不是与原库一模一样的数据结构。两者共享的核心思路包括：
//!
//! - dependency / subscriber 之间使用双向 Link；
//! - 依赖重新收集时复用前缀 Link，并剪掉本轮未读取的尾部依赖；
//! - 通过 DIRTY / PENDING / WATCHING 等标志避免重复传播；
//! - computed 在消费者运行前按需校验，值未变时不运行下游 effect。
//!
//! Rue 的主要适配是：
//!
//! - 原库使用基于指针的追加式 ChunkedArena 和 `unsafe`；Rue 使用可回收的
//!   代际 Arena，销毁组件 scope 后可重用槽位，陈旧 ID 也不会误访问新节点。
//! - 原库在图节点中保存强类型 signal/computed/effect 上下文；Rue 的值与 JS 回调
//!   仍由 `core.rs` / `signal.rs` 管理，本文件只负责拓扑、版本和状态。
//! - 原库的 `propagate` / `check_dirty` 是指针栈机；Rue 使用局部 `VecDeque` 传播，
//!   再通过版本号和沿 Link 直接执行的 computed 后序遍历完成增量校验。
//! - batch、microtask、frame、custom scheduler 和 effect scope 保留在 Rue 原有调度层，
//!   本图只返回稳定且去重的 effect id。
//!
//! # 架构设计
//!
//! ```text
//! Signal / Path dependency
//!          |
//!          | Link(dep -> sub)
//!          v
//!       Computed  ---- value_version ----+
//!          |                            |
//!          +------------ Link ----------+
//!                                       v
//!                                    Effect
//!                                       |
//!                                       v
//!                          Rue scheduler / batch / scope
//! ```
//!
//! ## 1. 图节点
//!
//! - `Dependency`：Signal 根值或某条规范化路径。
//! - `Computed`：同时是订阅者和依赖源，保存隐藏 computed effect 的 id。
//! - `Effect`：最终消费者，图层将它的 id 交给 Rue scheduler。
//!
//! ## 2. 双向 Link
//!
//! 每条 Link 同时位于两条链中：
//!
//! - `prev_dep / next_dep`：某个 subscriber 读取的全部 dependencies，顺序与回调读取顺序一致。
//! - `prev_sub / next_sub`：某个 dependency 的全部 subscribers，保留订阅顺序。
//!
//! 因此无需在 Signal 上维护 `Vec<effect_id>`，动态依赖切换也能从两个方向 O(1) 解链。
//!
//! ## 3. 依赖收集
//!
//! `begin_tracking` 将当前 effect/computed 设为 `active_sub`，并将依赖游标重置到头部。
//! 每次 Signal 读取通过 `track` 复用当前位置的 Link；`end_tracking` 将游标后的
//! Link 全部删除。这使条件分支切换后的旧依赖不再触发 effect。
//!
//! ## 4. 传播与去重
//!
//! dependency 变化时先递增 `value_version`，然后迭代访问 subscriber 链。第一次命中的
//! 节点进入 `PENDING`，后续从钻石图或根/路径另一条边再次到达时会直接跳过。
//! Effect 只在 `WATCHING` 时进入结果队列，入队后暂时取消 `WATCHING`，执行或重置后再恢复。
//!
//! ## 5. Computed 增量校验
//!
//! 传播阶段只将 computed 标记为 `PENDING`。真正执行下游 effect 前，
//! `pending_computed_effects` 以后序顺序列出待更新 computed；重算后只在结果真正变化时
//! 递增它的 `value_version`。`subscriber_needs_run` 比较 Link 记录的 `observed_version`，
//! 所有上游版本都未变时取消本次下游运行。
//!
//! ## 6. 生命周期与安全性
//!
//! 节点和 Link 都由 `(index, generation)` 定位。删除时 generation 递增，即使槽位被新节点复用，
//! 旧 ID 也无法访问它。`remove_node` 会同时解除入边和出边，使 dispose、scope 卸载与
//! 延迟 scheduler 遇到陈旧 id 时都可以安全 no-op。

use std::cell::RefCell;
use std::collections::VecDeque;
use std::ops::{BitAnd, BitOr, BitOrAssign, Not};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
/// 节点状态位。位定义与 alien-signals-rs 保持一致，以便对照算法语义。
pub(crate) struct Flags(u8);

impl Flags {
    pub(crate) const NONE: Self = Self(0);
    pub(crate) const MUTABLE: Self = Self(1 << 0);
    pub(crate) const WATCHING: Self = Self(1 << 1);
    pub(crate) const RECURSED_CHECK: Self = Self(1 << 2);
    pub(crate) const RECURSED: Self = Self(1 << 3);
    pub(crate) const DIRTY: Self = Self(1 << 4);
    pub(crate) const PENDING: Self = Self(1 << 5);

    pub(crate) fn intersects(self, other: Self) -> bool {
        (self & other) != Self::NONE
    }

    fn remove(&mut self, flags: Self) {
        *self = *self & !flags;
    }
}

impl BitAnd for Flags {
    type Output = Self;

    fn bitand(self, rhs: Self) -> Self::Output {
        Self(self.0 & rhs.0)
    }
}

impl BitOr for Flags {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self::Output {
        Self(self.0 | rhs.0)
    }
}

impl BitOrAssign for Flags {
    fn bitor_assign(&mut self, rhs: Self) {
        *self = *self | rhs;
    }
}

impl Not for Flags {
    type Output = Self;

    fn not(self) -> Self::Output {
        Self(!self.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
/// Arena 节点句柄。generation 用于拒绝槽位复用后的陈旧访问。
pub(crate) struct NodeId {
    index: u32,
    generation: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
/// Arena Link 句柄，仅在图内部流转。
struct LinkId {
    index: u32,
    generation: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
/// 图层只保留拓扑角色和 Rue effect id，不在此存储 JsValue 或回调。
pub(crate) enum NodeKind {
    Dependency,
    Computed(usize),
    Effect(usize),
}

impl NodeKind {
    fn initial_flags(self) -> Flags {
        match self {
            Self::Dependency => Flags::MUTABLE,
            Self::Computed(_) => Flags::MUTABLE | Flags::DIRTY,
            Self::Effect(_) => Flags::WATCHING,
        }
    }
}

struct Slot<T> {
    /// 每次释放槽位都递增，使旧 ID 立即失效。
    generation: u32,
    value: Option<T>,
}

/// 可回收的安全 Arena。
///
/// `free` 保存空闲下标；重用槽位时不会重置 generation。
/// 这是 Rue 与 alien-signals-rs 只追加指针 Arena 的关键差异。
struct Arena<T> {
    slots: Vec<Slot<T>>,
    free: Vec<u32>,
    len: usize,
}

impl<T> Default for Arena<T> {
    fn default() -> Self {
        Self { slots: Vec::new(), free: Vec::new(), len: 0 }
    }
}

impl<T> Arena<T> {
    fn insert<I>(&mut self, value: T, make_id: impl FnOnce(u32, u32) -> I) -> I {
        self.len += 1;
        if let Some(index) = self.free.pop() {
            let slot = &mut self.slots[index as usize];
            slot.value = Some(value);
            return make_id(index, slot.generation);
        }

        let index = self.slots.len() as u32;
        self.slots.push(Slot { generation: 0, value: Some(value) });
        make_id(index, 0)
    }

    fn get<I>(&self, id: I, parts: impl FnOnce(I) -> (u32, u32)) -> Option<&T> {
        let (index, generation) = parts(id);
        let slot = self.slots.get(index as usize)?;
        (slot.generation == generation).then_some(slot.value.as_ref()).flatten()
    }

    fn get_mut<I>(&mut self, id: I, parts: impl FnOnce(I) -> (u32, u32)) -> Option<&mut T> {
        let (index, generation) = parts(id);
        let slot = self.slots.get_mut(index as usize)?;
        (slot.generation == generation).then_some(slot.value.as_mut()).flatten()
    }

    fn remove<I>(&mut self, id: I, parts: impl FnOnce(I) -> (u32, u32)) -> Option<T> {
        let (index, generation) = parts(id);
        let slot = self.slots.get_mut(index as usize)?;
        if slot.generation != generation {
            return None;
        }
        let value = slot.value.take()?;
        slot.generation = slot.generation.wrapping_add(1);
        self.free.push(index);
        self.len -= 1;
        Some(value)
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.len
    }
}

struct Node {
    /// 节点在图中的角色。
    kind: NodeKind,
    /// 传播与增量检查状态。
    flags: Flags,
    /// 值真正变化的次数；结构性标脏不会自动增加它。
    value_version: u64,
    /// 作为 subscriber 时的依赖链。
    deps_head: Option<LinkId>,
    deps_tail: Option<LinkId>,
    /// 作为 dependency 时的订阅者链。
    subs_head: Option<LinkId>,
    subs_tail: Option<LinkId>,
}

#[derive(Clone, Copy)]
/// dependency 与 subscriber 之间的双向边。
struct Link {
    /// 最后一次收集到此边的 tracking cycle。
    version: u64,
    /// subscriber 上次读取时观察到的 dependency 值版本。
    observed_version: u64,
    dep: NodeId,
    sub: NodeId,
    /// 在 subscriber 的 dependencies 链中的前后指针。
    prev_dep: Option<LinkId>,
    next_dep: Option<LinkId>,
    /// 在 dependency 的 subscribers 链中的前后指针。
    prev_sub: Option<LinkId>,
    next_sub: Option<LinkId>,
}

#[derive(Clone, Copy)]
pub(crate) struct TrackingState {
    /// 嵌套 effect/computed 结束后需恢复的外层 subscriber。
    previous: Option<NodeId>,
}

#[derive(Default)]
/// 线程局部的拓扑引擎。调度队列与响应式值均不属于该结构。
pub(crate) struct Graph {
    /// 全局收集轮次，用于 Link 复用和重复读取判定。
    cycle: u64,
    /// 当前正在执行并允许收集依赖的 computed/effect。
    active_sub: Option<NodeId>,
    nodes: Arena<Node>,
    links: Arena<Link>,
}

impl Graph {
    /// 创建图节点，初始状态由节点角色决定。
    pub(crate) fn add_node(&mut self, kind: NodeKind) -> NodeId {
        self.nodes.insert(
            Node {
                kind,
                flags: kind.initial_flags(),
                value_version: 0,
                deps_head: None,
                deps_tail: None,
                subs_head: None,
                subs_tail: None,
            },
            |index, generation| NodeId { index, generation },
        )
    }

    pub(crate) fn contains(&self, id: NodeId) -> bool {
        self.node(id).is_some()
    }

    #[cfg(test)]
    pub(crate) fn flags(&self, id: NodeId) -> Option<Flags> {
        self.node(id).map(|node| node.flags)
    }

    /// 开始一轮依赖收集。
    ///
    /// `deps_tail = None` 表示复用游标回到依赖链头；旧 Link 此时不立即删除，
    /// 后续 `track` 可以按读取顺序原地复用它们。
    pub(crate) fn begin_tracking(&mut self, sub: NodeId) -> Option<TrackingState> {
        self.cycle = self.cycle.wrapping_add(1);
        let previous = self.active_sub;
        let node = self.node_mut(sub)?;
        node.deps_tail = None;
        node.flags |= Flags::RECURSED_CHECK;
        if matches!(node.kind, NodeKind::Effect(_)) {
            node.flags |= Flags::WATCHING;
        }
        self.active_sub = Some(sub);
        Some(TrackingState { previous })
    }

    /// 结束收集，剪掉游标之后本轮没有再读取的旧依赖，然后恢复外层 subscriber。
    pub(crate) fn end_tracking(&mut self, sub: NodeId, state: TrackingState) {
        if self.contains(sub) {
            self.purge_stale_dependencies(sub);
            if let Some(node) = self.node_mut(sub) {
                node.flags.remove(Flags::RECURSED_CHECK | Flags::RECURSED | Flags::PENDING);
                if matches!(node.kind, NodeKind::Effect(_)) {
                    node.flags |= Flags::WATCHING;
                }
            }
        }
        self.active_sub = state.previous.filter(|id| self.contains(*id));
    }

    /// 将某个 dependency 连接到当前 active subscriber。
    pub(crate) fn track(&mut self, dep: NodeId) -> bool {
        let Some(sub) = self.active_sub else {
            return false;
        };
        if dep == sub || !self.contains(dep) || !self.contains(sub) {
            return false;
        }
        self.link(dep, sub, self.cycle);
        true
    }

    #[cfg(test)]
    pub(crate) fn connect(&mut self, dep: NodeId, sub: NodeId) -> bool {
        if dep == sub || !self.contains(dep) || !self.contains(sub) {
            return false;
        }
        self.cycle = self.cycle.wrapping_add(1);
        self.link(dep, sub, self.cycle);
        true
    }

    /// 从变化的 dependency 向下游迭代传播 PENDING，返回需进入 Rue scheduler 的 effect id。
    ///
    /// 遍历使用队列而非递归，深链不会消耗 Rust 调用栈。节点第一次到达后已是
    /// PENDING/DIRTY，从钻石图的另一条边再到达时会直接跳过。
    pub(crate) fn propagate(&mut self, dep: NodeId) -> Vec<usize> {
        if !self.contains(dep) {
            return Vec::new();
        }
        let mut dependencies = VecDeque::from([dep]);
        let mut effects = Vec::new();

        while let Some(dependency) = dependencies.pop_front() {
            let mut link = self.node(dependency).and_then(|node| node.subs_head);
            while let Some(link_id) = link {
                let Some(edge) = self.link_ref(link_id).copied() else {
                    break;
                };
                link = edge.next_sub;
                let Some(subscriber) = self.node(edge.sub) else {
                    continue;
                };
                let kind = subscriber.kind;
                let flags = subscriber.flags;
                if flags.intersects(Flags::DIRTY | Flags::PENDING) {
                    continue;
                }
                if let Some(node) = self.node_mut(edge.sub) {
                    node.flags |= Flags::PENDING;
                }
                match kind {
                    NodeKind::Dependency => {}
                    NodeKind::Computed(_) => dependencies.push_back(edge.sub),
                    NodeKind::Effect(effect_id) if flags.intersects(Flags::WATCHING) => {
                        if let Some(node) = self.node_mut(edge.sub) {
                            node.flags.remove(Flags::WATCHING);
                        }
                        effects.push(effect_id);
                    }
                    NodeKind::Effect(_) => {}
                }
            }
        }

        effects
    }

    pub(crate) fn mark_clean(&mut self, id: NodeId) {
        if let Some(node) = self.node_mut(id) {
            node.flags.remove(Flags::DIRTY | Flags::PENDING | Flags::RECURSED);
            if matches!(node.kind, NodeKind::Effect(_)) {
                node.flags |= Flags::WATCHING;
            }
        }
    }

    /// 递增源节点的值版本并启动传播。
    pub(crate) fn trigger(&mut self, id: NodeId) -> Vec<usize> {
        let Some(node) = self.node_mut(id) else {
            return Vec::new();
        };
        node.value_version = node.value_version.wrapping_add(1);
        self.propagate(id)
    }

    pub(crate) fn bind_computed(&mut self, id: NodeId, effect_id: usize) -> bool {
        let Some(node) = self.node_mut(id) else {
            return false;
        };
        node.kind = NodeKind::Computed(effect_id);
        node.flags |= Flags::MUTABLE | Flags::DIRTY;
        true
    }

    pub(crate) fn invalidate_computed(&mut self, id: NodeId) -> Vec<usize> {
        let Some(node) = self.node_mut(id) else {
            return Vec::new();
        };
        node.flags |= Flags::DIRTY;
        self.propagate(id)
    }

    pub(crate) fn node_needs_update(&self, id: NodeId) -> bool {
        self.node(id).is_some_and(|node| node.flags.intersects(Flags::DIRTY | Flags::PENDING))
    }

    /// computed 重算完成。只有缓存值真正变化时才提升版本。
    pub(crate) fn commit_computed(&mut self, id: NodeId, changed: bool) {
        if let Some(node) = self.node_mut(id)
            && changed
        {
            node.value_version = node.value_version.wrapping_add(1);
        }
        self.mark_clean(id);
    }

    /// 按“上游先、下游后”的后序顺序收集待校验 computed。
    ///
    /// 遍历期间借用 `RECURSED` 作为 visited 标记，结束后统一清除；effect 去重仍由 PENDING/WATCHING 完成。
    pub(crate) fn pending_computed_effects(&mut self, sub: NodeId) -> Vec<(NodeId, usize)> {
        let mut output = Vec::new();
        let mut stack = Vec::new();

        // 从尾部向头部压栈，弹出时仍按 getter 的原始读取顺序处理依赖。
        let mut link = self.node(sub).and_then(|node| node.deps_tail);
        while let Some(link_id) = link {
            let Some(edge) = self.link_ref(link_id).copied() else {
                break;
            };
            stack.push((edge.dep, false));
            link = edge.prev_dep;
        }

        while let Some((node_id, expanded)) = stack.pop() {
            let Some(node) = self.node(node_id) else {
                continue;
            };
            let NodeKind::Computed(effect_id) = node.kind else {
                continue;
            };
            if !node.flags.intersects(Flags::DIRTY | Flags::PENDING) {
                continue;
            }
            if expanded {
                output.push((node_id, effect_id));
                continue;
            }
            if node.flags.intersects(Flags::RECURSED) {
                continue;
            }
            if let Some(node) = self.node_mut(node_id) {
                node.flags |= Flags::RECURSED;
            }
            stack.push((node_id, true));

            let mut link = self.node(node_id).and_then(|node| node.deps_tail);
            while let Some(link_id) = link {
                let Some(edge) = self.link_ref(link_id).copied() else {
                    break;
                };
                stack.push((edge.dep, false));
                link = edge.prev_dep;
            }
        }

        // visited 标记必须保留到整次遍历结束，才能对跨分支共享的 computed 去重。
        for (node_id, _) in &output {
            if let Some(node) = self.node_mut(*node_id) {
                node.flags.remove(Flags::RECURSED);
            }
        }
        output
    }

    /// 判断 subscriber 是否真的需要运行。
    ///
    /// PENDING 可能只代表“上游可能变了”。当所有 Link 的观测版本都与当前依赖版本一致时，
    /// 说明 computed 校验后值没有变，可以跳过 effect。
    pub(crate) fn subscriber_needs_run(&self, sub: NodeId) -> bool {
        let Some(node) = self.node(sub) else {
            return false;
        };
        if !node.flags.intersects(Flags::DIRTY | Flags::PENDING) {
            return true;
        }
        let mut link = node.deps_head;
        while let Some(link_id) = link {
            let Some(edge) = self.link_ref(link_id) else {
                break;
            };
            if self
                .node(edge.dep)
                .is_some_and(|dependency| dependency.value_version != edge.observed_version)
            {
                return true;
            }
            link = edge.next_dep;
        }
        false
    }

    /// 删除节点及其全部入边/出边。对陈旧 ID 重复调用是安全 no-op。
    pub(crate) fn remove_node(&mut self, id: NodeId) -> bool {
        if !self.contains(id) {
            return false;
        }
        while let Some(link) = self.node(id).and_then(|node| node.deps_head) {
            self.unlink(link);
        }
        while let Some(link) = self.node(id).and_then(|node| node.subs_head) {
            self.unlink(link);
        }
        if self.active_sub == Some(id) {
            self.active_sub = None;
        }
        self.nodes.remove(id, |id| (id.index, id.generation)).is_some()
    }

    #[cfg(test)]
    pub(crate) fn dependencies(&self, sub: NodeId) -> Vec<NodeId> {
        let mut dependencies = Vec::new();
        let mut link = self.node(sub).and_then(|node| node.deps_head);
        while let Some(link_id) = link {
            let Some(edge) = self.link_ref(link_id) else {
                break;
            };
            dependencies.push(edge.dep);
            link = edge.next_dep;
        }
        dependencies
    }

    pub(crate) fn subscriber_count(&self, dep: NodeId) -> usize {
        let mut count = 0;
        let mut link = self.node(dep).and_then(|node| node.subs_head);
        while let Some(link_id) = link {
            let Some(edge) = self.link_ref(link_id) else {
                break;
            };
            count += 1;
            link = edge.next_sub;
        }
        count
    }

    #[cfg(test)]
    pub(crate) fn link_count(&self) -> usize {
        self.links.len()
    }

    fn link(&mut self, dep: NodeId, sub: NodeId, version: u64) {
        // deps_tail 是本轮收集游标。相同 dependency 连续读取时无需新建 Link。
        let prev_dep = self.node(sub).and_then(|node| node.deps_tail);
        if prev_dep.and_then(|id| self.link_ref(id)).map(|edge| edge.dep) == Some(dep) {
            return;
        }

        let next_dep = match prev_dep {
            Some(link) => self.link_ref(link).and_then(|edge| edge.next_dep),
            None => self.node(sub).and_then(|node| node.deps_head),
        };
        // 最常见的快路径：依赖顺序没变，直接复用游标后的旧 Link。
        if let Some(next_dep) = next_dep
            && self.link_ref(next_dep).map(|edge| edge.dep) == Some(dep)
        {
            let observed_version = self.node(dep).map_or(0, |node| node.value_version);
            if let Some(edge) = self.link_mut(next_dep) {
                edge.version = version;
                edge.observed_version = observed_version;
            }
            if let Some(node) = self.node_mut(sub) {
                node.deps_tail = Some(next_dep);
            }
            return;
        }

        let prev_sub = self.node(dep).and_then(|node| node.subs_tail);
        // 同一 tracking cycle 内重复读取同一 dependency，不追加重复边。
        if prev_sub
            .and_then(|id| self.link_ref(id))
            .is_some_and(|edge| edge.version == version && edge.sub == sub)
        {
            return;
        }

        // 只有上述两种复用都失败时才分配新 Link。
        let observed_version = self.node(dep).map_or(0, |node| node.value_version);
        let link = self.links.insert(
            Link {
                version,
                observed_version,
                dep,
                sub,
                prev_dep,
                next_dep,
                prev_sub,
                next_sub: None,
            },
            |index, generation| LinkId { index, generation },
        );

        if let Some(node) = self.node_mut(dep) {
            node.subs_tail = Some(link);
            if node.subs_head.is_none() {
                node.subs_head = Some(link);
            }
        }
        if let Some(node) = self.node_mut(sub) {
            node.deps_tail = Some(link);
            if node.deps_head.is_none() {
                node.deps_head = Some(link);
            }
        }
        if let Some(previous) = prev_dep.and_then(|id| self.link_mut(id)) {
            previous.next_dep = Some(link);
        }
        if let Some(next) = next_dep.and_then(|id| self.link_mut(id)) {
            next.prev_dep = Some(link);
        }
        if let Some(previous) = prev_sub.and_then(|id| self.link_mut(id)) {
            previous.next_sub = Some(link);
        }
    }

    fn purge_stale_dependencies(&mut self, sub: NodeId) {
        // deps_tail 停在本轮最后一个有效依赖上；其后的 Link 属于旧分支。
        let cursor = self.node(sub).and_then(|node| node.deps_tail);
        let mut current = match cursor {
            Some(link) => self.link_ref(link).and_then(|edge| edge.next_dep),
            None => self.node(sub).and_then(|node| node.deps_head),
        };
        let mut stale = Vec::new();
        while let Some(link) = current {
            stale.push(link);
            current = self.link_ref(link).and_then(|edge| edge.next_dep);
        }
        for link in stale.into_iter().rev() {
            self.unlink(link);
        }
    }

    fn unlink(&mut self, link: LinkId) {
        let Some(edge) = self.link_ref(link).copied() else {
            return;
        };

        // 先从 subscriber.dependencies 链中摘除。
        if let Some(previous) = edge.prev_dep.and_then(|id| self.link_mut(id)) {
            previous.next_dep = edge.next_dep;
        } else if let Some(sub) = self.node_mut(edge.sub) {
            sub.deps_head = edge.next_dep;
        }
        if let Some(next) = edge.next_dep.and_then(|id| self.link_mut(id)) {
            next.prev_dep = edge.prev_dep;
        } else if let Some(sub) = self.node_mut(edge.sub) {
            sub.deps_tail = edge.prev_dep;
        }

        // 再从 dependency.subscribers 链中摘除。
        if let Some(previous) = edge.prev_sub.and_then(|id| self.link_mut(id)) {
            previous.next_sub = edge.next_sub;
        } else if let Some(dep) = self.node_mut(edge.dep) {
            dep.subs_head = edge.next_sub;
        }
        if let Some(next) = edge.next_sub.and_then(|id| self.link_mut(id)) {
            next.prev_sub = edge.prev_sub;
        } else if let Some(dep) = self.node_mut(edge.dep) {
            dep.subs_tail = edge.prev_sub;
        }

        self.links.remove(link, |id| (id.index, id.generation));
    }

    fn node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(id, |id| (id.index, id.generation))
    }

    fn node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(id, |id| (id.index, id.generation))
    }

    fn link_ref(&self, id: LinkId) -> Option<&Link> {
        self.links.get(id, |id| (id.index, id.generation))
    }

    fn link_mut(&mut self, id: LinkId) -> Option<&mut Link> {
        self.links.get_mut(id, |id| (id.index, id.generation))
    }
}

thread_local! {
    // Wasm 当前为单线程运行时；RefCell 使回调期借用冲突可被及时发现。
    static REACTIVE_GRAPH: RefCell<Graph> = RefCell::new(Graph::default());
}

// 以下函数是图层与 Rue core/signal/effect 的边界。
// 它们隐藏 thread_local RefCell，避免调用方直接操作 Graph 内部结构。
pub(crate) fn create_dependency_node() -> NodeId {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().add_node(NodeKind::Dependency))
}

pub(crate) fn create_effect_node(effect_id: usize) -> NodeId {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().add_node(NodeKind::Effect(effect_id)))
}

pub(crate) fn create_computed_node() -> NodeId {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().add_node(NodeKind::Computed(usize::MAX)))
}

pub(crate) fn bind_computed_node(node: NodeId, effect_id: usize) -> bool {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().bind_computed(node, effect_id))
}

pub(crate) fn begin_node_tracking(node: NodeId) -> Option<TrackingState> {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().begin_tracking(node))
}

pub(crate) fn end_node_tracking(node: NodeId, state: TrackingState) {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().end_tracking(node, state));
}

pub(crate) fn track_dependency(node: NodeId) -> bool {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().track(node))
}

pub(crate) fn propagate_dependency(node: NodeId) -> Vec<usize> {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().trigger(node))
}

pub(crate) fn dependency_subscriber_count(node: NodeId) -> usize {
    REACTIVE_GRAPH.with(|graph| graph.borrow().subscriber_count(node))
}

pub(crate) fn invalidate_computed_node(node: NodeId) -> Vec<usize> {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().invalidate_computed(node))
}

pub(crate) fn computed_node_needs_update(node: NodeId) -> bool {
    REACTIVE_GRAPH.with(|graph| graph.borrow().node_needs_update(node))
}

pub(crate) fn commit_computed_node(node: NodeId, changed: bool) {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().commit_computed(node, changed));
}

pub(crate) fn pending_computed_effects(node: NodeId) -> Vec<(NodeId, usize)> {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().pending_computed_effects(node))
}

pub(crate) fn subscriber_needs_run(node: NodeId) -> bool {
    REACTIVE_GRAPH.with(|graph| graph.borrow().subscriber_needs_run(node))
}

pub(crate) fn mark_node_clean(node: NodeId) {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().mark_clean(node));
}

pub(crate) fn remove_reactive_node(node: NodeId) -> bool {
    REACTIVE_GRAPH.with(|graph| graph.borrow_mut().remove_node(node))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::hint::black_box;
    use std::time::Instant;

    fn legacy_pending_computed_effects(graph: &Graph, sub: NodeId) -> Vec<(NodeId, usize)> {
        let mut output = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut stack = Vec::new();
        for dependency in graph.dependencies(sub).into_iter().rev() {
            stack.push((dependency, false));
        }

        while let Some((node_id, expanded)) = stack.pop() {
            let Some(node) = graph.node(node_id) else {
                continue;
            };
            let NodeKind::Computed(effect_id) = node.kind else {
                continue;
            };
            if !node.flags.intersects(Flags::DIRTY | Flags::PENDING) {
                continue;
            }
            if expanded {
                output.push((node_id, effect_id));
                continue;
            }
            if !seen.insert(node_id) {
                continue;
            }
            stack.push((node_id, true));
            for dependency in graph.dependencies(node_id).into_iter().rev() {
                stack.push((dependency, false));
            }
        }
        output
    }

    fn measure_legacy_pending(graph: &Graph, sub: NodeId, iterations: usize) -> u128 {
        let started = Instant::now();
        for _ in 0..iterations {
            black_box(legacy_pending_computed_effects(graph, sub));
        }
        started.elapsed().as_nanos()
    }

    fn measure_link_walk_pending(graph: &mut Graph, sub: NodeId, iterations: usize) -> u128 {
        let started = Instant::now();
        for _ in 0..iterations {
            black_box(graph.pending_computed_effects(sub));
        }
        started.elapsed().as_nanos()
    }

    #[test]
    fn graph_reuses_links_and_purges_stale_tail() {
        let mut graph = Graph::default();
        let first = graph.add_node(NodeKind::Dependency);
        let second = graph.add_node(NodeKind::Dependency);
        let effect = graph.add_node(NodeKind::Effect(7));

        let outer = graph.begin_tracking(effect).unwrap();
        assert!(graph.track(first));
        assert!(graph.track(second));
        graph.end_tracking(effect, outer);
        assert_eq!(graph.link_count(), 2);

        let outer = graph.begin_tracking(effect).unwrap();
        assert!(graph.track(first));
        assert!(graph.track(first));
        graph.end_tracking(effect, outer);

        assert_eq!(graph.link_count(), 1);
        assert_eq!(graph.dependencies(effect), vec![first]);
        assert_eq!(graph.subscriber_count(first), 1);
        assert_eq!(graph.subscriber_count(second), 0);
    }

    #[test]
    fn graph_propagates_diamond_once_in_order() {
        let mut graph = Graph::default();
        let source = graph.add_node(NodeKind::Dependency);
        let left = graph.add_node(NodeKind::Computed(1));
        let right = graph.add_node(NodeKind::Computed(2));
        let joined = graph.add_node(NodeKind::Computed(3));
        let effect = graph.add_node(NodeKind::Effect(42));

        graph.connect(source, left);
        graph.connect(source, right);
        graph.connect(left, joined);
        graph.connect(right, joined);
        graph.connect(joined, effect);
        graph.mark_clean(left);
        graph.mark_clean(right);
        graph.mark_clean(joined);

        assert_eq!(graph.propagate(source), vec![42]);
        assert!(graph.flags(joined).unwrap().intersects(Flags::PENDING));
        assert_eq!(graph.propagate(source), Vec::<usize>::new());
    }

    #[test]
    fn graph_propagates_thousand_node_chain_iteratively() {
        let mut graph = Graph::default();
        let source = graph.add_node(NodeKind::Dependency);
        let mut previous = source;

        for effect_id in 0..1_000 {
            let computed = graph.add_node(NodeKind::Computed(effect_id));
            assert!(graph.connect(previous, computed));
            graph.mark_clean(computed);
            previous = computed;
        }

        let effect = graph.add_node(NodeKind::Effect(42));
        assert!(graph.connect(previous, effect));
        assert_eq!(graph.propagate(source), vec![42]);
    }

    /// 手动运行的图层 A/B 微基准，不进入常规测试时间。
    ///
    /// 运行：`cargo test --release --lib benchmark_pending_computed_link_walk -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn benchmark_pending_computed_link_walk() {
        let mut graph = Graph::default();
        let source = graph.add_node(NodeKind::Dependency);
        let mut previous = source;
        for effect_id in 0..100 {
            let computed = graph.add_node(NodeKind::Computed(effect_id));
            assert!(graph.connect(previous, computed));
            graph.mark_clean(computed);
            previous = computed;
        }
        let effect = graph.add_node(NodeKind::Effect(100));
        assert!(graph.connect(previous, effect));
        assert_eq!(graph.propagate(source), vec![100]);

        const ITERATIONS: usize = 5_000;
        const ROUNDS: usize = 7;
        let mut legacy_samples = Vec::with_capacity(ROUNDS);
        let mut link_walk_samples = Vec::with_capacity(ROUNDS);

        for round in 0..ROUNDS {
            // 交替执行顺序，降低温度和系统调度对某一实现的固定偏置。
            if round % 2 == 0 {
                legacy_samples.push(measure_legacy_pending(&graph, effect, ITERATIONS));
                link_walk_samples.push(measure_link_walk_pending(&mut graph, effect, ITERATIONS));
            } else {
                link_walk_samples.push(measure_link_walk_pending(&mut graph, effect, ITERATIONS));
                legacy_samples.push(measure_legacy_pending(&graph, effect, ITERATIONS));
            }
        }

        legacy_samples.sort_unstable();
        link_walk_samples.sort_unstable();
        let legacy = legacy_samples[ROUNDS / 2] as f64 / ITERATIONS as f64;
        let link_walk = link_walk_samples[ROUNDS / 2] as f64 / ITERATIONS as f64;
        println!(
            "pending-computed depth=100 legacy={legacy:.1}ns link-walk={link_walk:.1}ns change={:.2}%",
            (link_walk - legacy) / legacy * 100.0
        );
        assert_eq!(graph.pending_computed_effects(effect).len(), 100);
        assert_eq!(legacy_pending_computed_effects(&graph, effect).len(), 100);
    }

    #[test]
    fn graph_removal_rejects_stale_ids_and_unlinks_edges() {
        let mut graph = Graph::default();
        let dependency = graph.add_node(NodeKind::Dependency);
        let effect = graph.add_node(NodeKind::Effect(9));
        graph.connect(dependency, effect);

        assert!(graph.remove_node(effect));
        assert_eq!(graph.link_count(), 0);
        assert_eq!(graph.subscriber_count(dependency), 0);
        assert!(!graph.contains(effect));
        assert!(!graph.remove_node(effect));

        assert!(graph.remove_node(dependency));
        let replacement = graph.add_node(NodeKind::Dependency);
        assert_ne!(replacement, dependency);
        assert!(!graph.contains(dependency));
        assert!(graph.contains(replacement));
    }

    #[test]
    fn graph_restores_nested_active_subscriber() {
        let mut graph = Graph::default();
        let outer_effect = graph.add_node(NodeKind::Effect(1));
        let inner_effect = graph.add_node(NodeKind::Effect(2));
        let outer_dep = graph.add_node(NodeKind::Dependency);
        let inner_dep = graph.add_node(NodeKind::Dependency);

        let root = graph.begin_tracking(outer_effect).unwrap();
        assert!(graph.track(outer_dep));
        let outer = graph.begin_tracking(inner_effect).unwrap();
        assert!(graph.track(inner_dep));
        graph.end_tracking(inner_effect, outer);
        assert!(graph.track(outer_dep));
        graph.end_tracking(outer_effect, root);

        assert_eq!(graph.dependencies(outer_effect), vec![outer_dep]);
        assert_eq!(graph.dependencies(inner_effect), vec![inner_dep]);
    }

    #[test]
    fn graph_handles_empty_tracking_and_repeated_removal() {
        let mut graph = Graph::default();
        let effect = graph.add_node(NodeKind::Effect(3));
        let previous = graph.begin_tracking(effect).unwrap();
        graph.end_tracking(effect, previous);
        assert!(graph.dependencies(effect).is_empty());
        assert!(graph.remove_node(effect));
        assert!(!graph.remove_node(effect));
    }
}

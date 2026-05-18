use swc_plugin_rue::apply;

mod utils;

#[test]
fn lowers_single_root_native_list_items_to_render_anchor() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ items: Array<{ id: string; title: string }> }> = props => (
  <ul>
    {props.items.map(item => (
      <li key={item.id}>{item.title}</li>
    ))}
  </ul>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, parent, start)")));
    assert!(!out.contains(&utils::normalize("renderBetween(__slot, parent, start, end)")));
}

#[test]
fn lowers_single_root_fragment_list_items_to_render_anchor() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ items: Array<{ id: string; title: string }> }> = props => (
  <ul>
    {props.items.map(item => (
      <>
        <li key={item.id}>{item.title}</li>
      </>
    ))}
  </ul>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, parent, start)")));
    assert!(!out.contains(&utils::normalize("renderBetween(__slot, parent, start, end)")));
}

#[test]
fn lowers_nested_single_root_fragment_list_items_to_render_anchor() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ items: Array<{ id: string; title: string }> }> = props => (
  <ul>
    {props.items.map(item => (
      <>
        <>
          <li key={item.id}>{item.title}</li>
        </>
      </>
    ))}
  </ul>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, parent, start)")));
    assert!(!out.contains(&utils::normalize("renderBetween(__slot, parent, start, end)")));
}

#[test]
fn lowers_single_root_builtin_fragment_list_items_to_render_anchor() {
    let src = r##"
import { type FC, Fragment } from '@rue-js/rue';

const Page: FC<{ items: Array<{ id: string; title: string }> }> = props => (
  <ul>
    {props.items.map(item => (
      <Fragment key={item.id}>
        <li>{item.title}</li>
      </Fragment>
    ))}
  </ul>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("const __slot = __child1;")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, parent, start)")));
    assert!(!out.contains(&utils::normalize("renderBetween(__slot, parent, start, end)")));
}

#[test]
fn marks_single_root_list_items_without_index_param_as_not_tracking_index() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ items: Array<{ id: string; title: string }> }> = props => (
  <ul>
    {props.items.map(item => (
      <li key={item.id}>{item.title}</li>
    ))}
  </ul>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("trackIndex: false")));
}

#[test]
fn marks_local_todo_shaped_single_root_items_as_not_tracking_index() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ todos: Array<{ id: number; text: string; completed: boolean }>; toggleTodo: (id: number) => void; deleteTodo: (id: number) => void }> = props => (
  <div>
    {props.todos.map(todo => (
      <div
        key={todo.id}
        className={`row ${todo.completed ? 'done' : 'open'}`}
      >
        <span onClick={() => props.toggleTodo(todo.id)}>{todo.text}</span>
        <button onClick={() => props.deleteTodo(todo.id)}>删除</button>
      </div>
    ))}
  </div>
)
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));
    println!("{}", out);

    assert!(out.contains(&utils::normalize("singleRoot: true")));
    assert!(out.contains(&utils::normalize("trackIndex: false")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, parent, start)")));
}

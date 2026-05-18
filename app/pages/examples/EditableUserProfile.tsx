import createHomeSplitExamplePage from './createHomeSplitExamplePage'
import EditableUserProfileDemo from './home-demos/EditableUserProfileDemo'
import source from './home-demos/EditableUserProfileDemo.tsx?raw'

const EditableUserProfile = createHomeSplitExamplePage({
  title: '用户资料编辑',
  source,
  Demo: EditableUserProfileDemo,
})

export default EditableUserProfile

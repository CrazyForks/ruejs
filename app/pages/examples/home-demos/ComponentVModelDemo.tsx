import { type FC, ref } from '@rue-js/rue'

const ControlledInput: FC<{
  modelValue?: string
  ['onUpdate:modelValue']?: (value: string) => void
  vModel?: { value: string }
}> = props => {
  return (
    <input
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-400 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 px-3 py-2"
      value={props.modelValue ?? ''}
      onInput={(event: any) =>
        props['onUpdate:modelValue']?.((event.target as HTMLInputElement).value)
      }
    />
  )
}

const ControlledCheckbox: FC<{
  modelValue?: boolean
  ['onUpdate:modelValue']?: (value: boolean) => void
  vModel?: { value: boolean }
}> = props => {
  return (
    <label className="flex items-center space-x-2">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 focus:ring-offset-0 disabled:cursor-not-allowed disabled:text-gray-400"
        checked={!!props.modelValue}
        onChange={(event: any) =>
          props['onUpdate:modelValue']?.((event.target as HTMLInputElement).checked)
        }
      />
      <span className="text-sm font-medium text-gray-700">同意协议</span>
    </label>
  )
}

const modelName = ref('小明')
const agree = ref(false)

const ComponentVModelDemo: FC = () => {
  const inputBindings = {
    modelValue: modelName.value,
    'onUpdate:modelValue': (value: string) => {
      modelName.value = value
    },
  }

  const checkboxBindings = {
    modelValue: agree.value,
    'onUpdate:modelValue': (value: boolean) => {
      agree.value = value
    },
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <h2 className="text-2xl font-semibold text-emerald-600 mb-3">组件级 vModel</h2>
        <ControlledInput {...inputBindings} />
        <p className="text-gray-700">姓名：{modelName.value}</p>
        <ControlledCheckbox {...checkboxBindings} />
        <p className="text-gray-700">同意状态：{agree.value ? '是' : '否'}</p>
      </div>
    </div>
  )
}

export default ComponentVModelDemo

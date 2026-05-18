/* RUE_VAPOR_TRANSFORMED */
/*
FileInput 组件概述
- 保留 Rue 当前 `input[type=file] + file-input-*` 的原始样式入口。
- 文件列表、拖拽选择、图片卡片、受控/非受控与 beforeUpload。
- 组件仍聚焦“文件选择与列表编排”，真正的上传请求继续由业务侧处理。
*/
import type { FC } from '@rue-js/rue'
import { onMounted, ref, render as renderRue, useRef, watch } from '@rue-js/rue'

export type FileInputVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type FileInputSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'small'
  | 'middle'
  | 'medium'
  | 'large'
export type FileInputListType = 'text' | 'picture' | 'picture-card'
export type FileInputStatus = 'ready' | 'uploading' | 'done' | 'error' | 'removed'

export interface FileInputFile {
  uid?: string
  name: string
  status?: FileInputStatus
  size?: number
  type?: string
  percent?: number
  url?: string
  thumbUrl?: string
  preview?: string
  lastModified?: number
  originFileObj?: File | Blob | null
  response?: any
  error?: any
  description?: any
  [key: string]: any
}

export interface FileInputShowUploadList {
  showPreviewIcon?: boolean
  showRemoveIcon?: boolean
  extra?: any | ((file: FileInputFile) => any)
  itemRender?: (
    file: FileInputFile,
    defaultNode: any,
    actions: { preview: () => void; remove: () => void },
  ) => any
}

export interface FileInputChangeInfo {
  file: FileInputFile
  fileList: FileInputFile[]
  source: 'select' | 'drop' | 'remove'
  nativeEvent?: Event | DragEvent
}

export type FileInputBeforeUploadResult =
  | boolean
  | File
  | Blob
  | typeof FILE_INPUT_LIST_IGNORE
  | Promise<boolean | File | Blob | typeof FILE_INPUT_LIST_IGNORE>

export type FileInputBeforeUpload = (file: File, fileList: File[]) => FileInputBeforeUploadResult
export type FileInputPreviewHandler = (file: FileInputFile) => void | Promise<void>
export type FileInputRemoveHandler = (
  file: FileInputFile,
) => boolean | void | Promise<boolean | void>
export type FileInputPreviewFile = (file: File | Blob) => Promise<string>

export interface FileInputProps {
  variant?: FileInputVariant
  size?: FileInputSize
  ghost?: boolean
  className?: string
  rootClassName?: string
  triggerClassName?: string
  listClassName?: string
  itemClassName?: string
  drag?: boolean
  listType?: FileInputListType
  showUploadList?: boolean | FileInputShowUploadList
  fileList?: FileInputFile[]
  defaultFileList?: FileInputFile[]
  maxCount?: number
  title?: any
  description?: any
  hint?: any
  buttonText?: any
  empty?: any
  multiple?: boolean
  directory?: boolean
  disabled?: boolean
  openFileDialogOnClick?: boolean
  children?: any
  beforeUpload?: FileInputBeforeUpload
  onPreview?: FileInputPreviewHandler
  onRemove?: FileInputRemoveHandler
  previewFile?: FileInputPreviewFile
  onChange?: ((event: Event) => void) | ((info: FileInputChangeInfo) => void)
  [key: string]: any
}

type FileInputCompound = FC<FileInputProps> & {
  Dragger: FC<FileInputProps>
  LIST_IGNORE: typeof FILE_INPUT_LIST_IGNORE
}

const FILE_INPUT_LIST_IGNORE = Symbol('RUE_FILE_INPUT_LIST_IGNORE')
let uidSeed = 0

const mergeClassNames = (...parts: Array<string | undefined | false | null>) => {
  return parts.filter(Boolean).join(' ')
}

const isPromiseLike = <T,>(value: any): value is Promise<T> => {
  return !!value && typeof value === 'object' && typeof value.then === 'function'
}

const resolveSizeClass = (size?: FileInputSize) => {
  switch (size) {
    case 'small':
      return 'sm'
    case 'middle':
    case 'medium':
      return 'md'
    case 'large':
      return 'lg'
    default:
      return size
  }
}

const buildNativeInputClassName = ({
  variant,
  size,
  ghost,
  className,
}: Pick<FileInputProps, 'variant' | 'size' | 'ghost' | 'className'>) => {
  let cls = 'file-input'
  const resolvedSize = resolveSizeClass(size)
  if (variant) cls += ` file-input-${variant}`
  if (resolvedSize) cls += ` file-input-${resolvedSize}`
  if (ghost) cls += ' file-input-ghost'
  if (className) cls += ` ${className}`
  return cls
}

const buildTriggerButtonClassName = ({
  variant,
  size,
  ghost,
  className,
}: Pick<FileInputProps, 'variant' | 'size' | 'ghost'> & { className?: string }) => {
  let cls = 'btn'
  const resolvedSize = resolveSizeClass(size)
  if (variant) cls += ` btn-${variant}`
  if (resolvedSize) cls += ` btn-${resolvedSize}`
  if (ghost) cls += ' btn-ghost'
  if (className) cls += ` ${className}`
  return cls
}

const buildDropzoneClassName = ({
  variant,
  disabled,
  dragging,
  className,
}: {
  variant?: FileInputVariant
  disabled?: boolean
  dragging?: boolean
  className?: string
}) => {
  return mergeClassNames(
    'rounded-box border-2 border-dashed bg-base-100 p-5 transition',
    dragging ? 'border-primary bg-primary/5' : 'border-base-300',
    variant ? `text-${variant}` : undefined,
    disabled
      ? 'cursor-not-allowed opacity-60'
      : 'cursor-pointer hover:border-primary/40 hover:bg-base-200/40',
    className,
  )
}

const buildStatusBadgeClassName = (status?: FileInputStatus) => {
  switch (status) {
    case 'done':
      return 'badge-success'
    case 'error':
      return 'badge-error'
    case 'uploading':
      return 'badge-info'
    case 'removed':
      return 'badge-ghost'
    default:
      return 'badge-ghost'
  }
}

const isPictureType = (listType?: FileInputListType) => {
  return listType === 'picture' || listType === 'picture-card'
}

const isImageLike = (file: FileInputFile) => {
  if (file.type?.startsWith('image/')) return true
  const url = file.thumbUrl ?? file.url ?? file.preview ?? ''
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(url)
}

const readFileAsDataUrl = (file: File | Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string) ?? '')
    reader.onerror = error => reject(error)
    reader.readAsDataURL(file)
  })
}

const defaultPreviewFile: FileInputPreviewFile = file => {
  return readFileAsDataUrl(file)
}

const createUid = () => {
  uidSeed += 1
  return `rue-file-${uidSeed}`
}

const cloneFileItem = (file: FileInputFile): FileInputFile => {
  return { ...file }
}

const toFileItem = (file: File | Blob, fallbackName?: string): FileInputFile => {
  const source = file as File
  const name =
    'name' in source && typeof source.name === 'string' ? source.name : (fallbackName ?? 'file')
  const lastModified =
    'lastModified' in source && typeof source.lastModified === 'number'
      ? source.lastModified
      : undefined

  return {
    uid: createUid(),
    name,
    status: 'ready',
    size: typeof file.size === 'number' ? file.size : undefined,
    type: file.type || undefined,
    lastModified,
    originFileObj: file,
  }
}

const normalizeFileItem = (file: FileInputFile, index: number): FileInputFile => {
  return {
    status: 'done',
    ...file,
    uid: file.uid ?? `preset-file-${index}-${createUid()}`,
    name: file.name ?? `file-${index + 1}`,
  }
}

const normalizeFileList = (fileList?: FileInputFile[]) => {
  return (fileList ?? []).map((file, index) => normalizeFileItem(cloneFileItem(file), index))
}

const applyMaxCount = (fileList: FileInputFile[], maxCount?: number) => {
  if (!maxCount || maxCount <= 0) return fileList
  if (maxCount === 1) return fileList.slice(-1)
  return fileList.slice(-maxCount)
}

const formatFileSize = (size?: number) => {
  if (typeof size !== 'number' || !Number.isFinite(size)) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 1024 * 100 ? 0 : 1)} KB`
  return `${(size / (1024 * 1024)).toFixed(size >= 1024 * 1024 * 10 ? 0 : 1)} MB`
}

const isEnhancedMode = (props: FileInputProps) => {
  const hasCustomChildren =
    props.children !== undefined &&
    props.children !== null &&
    (!Array.isArray(props.children) || props.children.length > 0)

  return (
    props.drag === true ||
    hasCustomChildren ||
    props.fileList !== undefined ||
    props.defaultFileList !== undefined ||
    (props.listType !== undefined && props.listType !== 'text') ||
    (props.showUploadList !== undefined && props.showUploadList !== true) ||
    props.maxCount !== undefined ||
    props.beforeUpload !== undefined ||
    props.onPreview !== undefined ||
    props.onRemove !== undefined ||
    props.rootClassName !== undefined ||
    props.triggerClassName !== undefined ||
    props.listClassName !== undefined ||
    props.itemClassName !== undefined ||
    props.title !== undefined ||
    props.description !== undefined ||
    props.hint !== undefined ||
    props.buttonText !== undefined ||
    props.empty !== undefined ||
    props.directory === true ||
    props.openFileDialogOnClick === false
  )
}

const DefaultUploadIcon: FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={mergeClassNames('size-5', className)}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V5m0 0-4 4m4-4 4 4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 16.5V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5"
      />
    </svg>
  )
}

const DefaultPlusIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}

const DefaultFileIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </svg>
  )
}

const DefaultImageIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 16-5.5-5.5L7 19" />
    </svg>
  )
}

const DefaultPreviewIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const DefaultRemoveIcon: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}

const FileInputRoot: FC<FileInputProps> = ({
  variant,
  size,
  ghost,
  className,
  rootClassName,
  triggerClassName,
  listClassName,
  itemClassName,
  drag,
  listType,
  showUploadList,
  fileList,
  defaultFileList,
  maxCount,
  title,
  description,
  hint,
  buttonText,
  empty,
  multiple,
  directory,
  disabled,
  openFileDialogOnClick,
  children,
  beforeUpload,
  onPreview,
  onRemove,
  previewFile,
  onChange,
  ...rest
}) => {
  const enhancedMode = isEnhancedMode({
    variant,
    size,
    ghost,
    className,
    rootClassName,
    triggerClassName,
    listClassName,
    itemClassName,
    drag,
    listType,
    showUploadList,
    fileList,
    defaultFileList,
    maxCount,
    title,
    description,
    hint,
    buttonText,
    empty,
    multiple,
    directory,
    disabled,
    openFileDialogOnClick,
    children,
    beforeUpload,
    onPreview,
    onRemove,
    previewFile,
    onChange,
  })
  const resolvedListType = listType ?? 'text'
  const resolvedShowUploadList = showUploadList ?? true
  const resolvedOpenFileDialogOnClick = openFileDialogOnClick ?? true
  const resolvedPreviewFile = previewFile ?? defaultPreviewFile

  if (!enhancedMode) {
    return (
      <input
        {...rest}
        type="file"
        multiple={multiple}
        disabled={disabled}
        className={buildNativeInputClassName({ variant, size, ghost, className })}
      />
    )
  }

  const inputRef = useRef<HTMLInputElement>()
  const dynamicHostRef = useRef<HTMLDivElement>()
  const forwardedRef = rest.ref
  const dragging = ref(false)
  const controlled = fileList !== undefined
  const currentFileList = ref(normalizeFileList(controlled ? fileList : defaultFileList))
  const listVersion = ref(0)
  const uploadListConfig =
    resolvedShowUploadList && typeof resolvedShowUploadList === 'object'
      ? resolvedShowUploadList
      : undefined
  const listVisible = resolvedShowUploadList !== false
  const showPreviewIcon = uploadListConfig?.showPreviewIcon ?? true
  const showRemoveIcon = uploadListConfig?.showRemoveIcon ?? true
  const acceptsMany = multiple || (typeof maxCount === 'number' && maxCount > 1)

  if ('ref' in rest) {
    delete rest.ref
  }

  const assignInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element ?? undefined
    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }
    if (forwardedRef && typeof forwardedRef === 'object') {
      ;(forwardedRef as any).current = element ?? undefined
    }
  }

  const syncFromProps = () => {
    if (controlled) {
      currentFileList.value = normalizeFileList(fileList)
      listVersion.value += 1
    }
  }

  const updateFileListState = (nextFileList: FileInputFile[]) => {
    if (!controlled) {
      currentFileList.value = nextFileList
      listVersion.value += 1
    }
  }

  const emitEnhancedChange = (info: FileInputChangeInfo) => {
    if (typeof onChange === 'function') {
      ;(onChange as (info: FileInputChangeInfo) => void)(info)
    }
  }

  const openPicker = () => {
    if (disabled || !resolvedOpenFileDialogOnClick) return
    inputRef.current?.click()
  }

  const clearNativeInputValue = () => {
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const resolvePreviewUrl = async (file: FileInputFile) => {
    if (file.thumbUrl) return file.thumbUrl
    if (file.url) return file.url
    if (file.preview) return file.preview
    const originFile = file.originFileObj
    if (!originFile) return ''
    const previewData = await resolvedPreviewFile(originFile)
    file.preview = previewData
    return previewData
  }

  const handlePreview = async (file: FileInputFile) => {
    if (onPreview) {
      await onPreview(file)
      return
    }
    const previewUrl = await resolvePreviewUrl(file)
    if (previewUrl && typeof window !== 'undefined') {
      window.open(previewUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const applyRemove = (file: FileInputFile) => {
    const nextFileList = currentFileList.value.filter(
      item => item.uid !== file.uid && item.uid !== undefined,
    )
    if (nextFileList.length !== currentFileList.value.length - 1) {
      console.warn('File removal mismatch detected. Ensure file.uid is valid.')
    }
    updateFileListState(nextFileList)
    emitEnhancedChange({
      file: {
        ...file,
        status: 'removed',
      },
      fileList: nextFileList,
      source: 'remove',
    })
  }

  const handleRemove = (file: FileInputFile) => {
    if (disabled) return
    if (!onRemove) {
      applyRemove(file)
      return
    }

    const result = onRemove(file)
    if (isPromiseLike<boolean | void>(result)) {
      void result.then(removeResult => {
        if (removeResult === false) return
        applyRemove(file)
      })
      return
    }
    if (result === false) return
    applyRemove(file)
  }

  const normalizeSelectedResult = (
    selectedFile: File,
    beforeResult: boolean | File | Blob | typeof FILE_INPUT_LIST_IGNORE,
  ) => {
    if (beforeResult === FILE_INPUT_LIST_IGNORE) return null
    if (beforeResult instanceof Blob) {
      const transformedFile =
        beforeResult instanceof File
          ? beforeResult
          : new File([beforeResult], selectedFile.name, {
              type: beforeResult.type || selectedFile.type,
              lastModified: selectedFile.lastModified,
            })
      return toFileItem(transformedFile, selectedFile.name)
    }
    return toFileItem(selectedFile, selectedFile.name)
  }

  const commitSelectedFiles = (
    resolvedFiles: FileInputFile[],
    source: 'select' | 'drop',
    nativeEvent?: Event | DragEvent,
  ) => {
    if (resolvedFiles.length <= 0) {
      clearNativeInputValue()
      return
    }

    const nextFileList = applyMaxCount(
      [...currentFileList.value.map(cloneFileItem), ...resolvedFiles],
      maxCount,
    )
    updateFileListState(nextFileList)
    emitEnhancedChange({
      file: nextFileList[nextFileList.length - 1],
      fileList: nextFileList,
      source,
      nativeEvent,
    })
    clearNativeInputValue()
  }

  const buildSelectedList = (
    selectedFiles: File[],
    source: 'select' | 'drop',
    nativeEvent?: Event | DragEvent,
  ) => {
    const resolvedFiles: FileInputFile[] = []

    const processAt = (index: number): void => {
      if (index >= selectedFiles.length) {
        commitSelectedFiles(resolvedFiles, source, nativeEvent)
        return
      }

      const selectedFile = selectedFiles[index]
      if (!beforeUpload) {
        resolvedFiles.push(toFileItem(selectedFile, selectedFile.name))
        processAt(index + 1)
        return
      }

      const beforeResult = beforeUpload(selectedFile, selectedFiles)
      if (isPromiseLike<boolean | File | Blob | typeof FILE_INPUT_LIST_IGNORE>(beforeResult)) {
        void beforeResult.then(asyncResult => {
          const normalized = normalizeSelectedResult(selectedFile, asyncResult)
          if (normalized) resolvedFiles.push(normalized)
          processAt(index + 1)
        })
        return
      }

      const normalized = normalizeSelectedResult(selectedFile, beforeResult)
      if (normalized) resolvedFiles.push(normalized)
      processAt(index + 1)
    }

    processAt(0)
  }

  const handleNativeChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null
    const selectedFiles = Array.from(target?.files ?? [])
    buildSelectedList(selectedFiles, 'select', event)
  }

  const handleDragOver = (event: DragEvent) => {
    if (disabled) return
    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    dragging.value = true
  }

  const handleDragLeave = (event: DragEvent) => {
    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    const currentTarget = event.currentTarget as HTMLElement | null
    const nextTarget = event.relatedTarget as Node | null
    if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
      return
    }
    dragging.value = false
  }

  const handleDrop = (event: DragEvent) => {
    if (disabled) return
    if (typeof (event as any).preventDefault === 'function') {
      ;(event as any).preventDefault()
    }
    dragging.value = false
    const droppedFiles = Array.from(event.dataTransfer?.files ?? [])
    buildSelectedList(droppedFiles, 'drop', event)
  }

  const renderFileThumb = (file: FileInputFile) => {
    const previewUrl = file.thumbUrl ?? file.url ?? file.preview
    if (previewUrl && isImageLike(file)) {
      return <img src={previewUrl} alt={file.name} className="size-full object-cover" />
    }
    return (
      <div className="flex size-full items-center justify-center rounded-box bg-base-200 text-base-content/60">
        {isImageLike(file) ? <DefaultImageIcon /> : <DefaultFileIcon />}
      </div>
    )
  }

  const renderListItem = (file: FileInputFile) => {
    const extraContent =
      typeof uploadListConfig?.extra === 'function'
        ? uploadListConfig.extra(file)
        : uploadListConfig?.extra

    const defaultNode =
      resolvedListType === 'picture-card' ? (
        <div
          className={mergeClassNames(
            'group relative flex aspect-square flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm',
            itemClassName,
          )}
        >
          <button
            type="button"
            className="relative flex flex-1 items-center justify-center overflow-hidden bg-base-200/60 text-base-content"
            onClick={() => void handlePreview(file)}
            disabled={disabled}
          >
            {renderFileThumb(file)}
          </button>
          <div className="border-t border-base-300 px-3 py-2">
            <div className="truncate text-sm font-medium">{file.name}</div>
            {extraContent !== undefined ? (
              <div className="mt-1 text-xs text-base-content/60">{extraContent}</div>
            ) : null}
          </div>
          {(showPreviewIcon || showRemoveIcon) && !disabled ? (
            <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
              {showPreviewIcon ? (
                <button
                  type="button"
                  className="btn btn-circle btn-xs border-none bg-base-100/90 shadow-sm"
                  aria-label={`Preview ${file.name}`}
                  onClick={(event: MouseEvent) => {
                    if (typeof (event as any).stopPropagation === 'function') {
                      ;(event as any).stopPropagation()
                    }
                    void handlePreview(file)
                  }}
                >
                  <DefaultPreviewIcon />
                </button>
              ) : null}
              {showRemoveIcon ? (
                <button
                  type="button"
                  className="btn btn-circle btn-xs border-none bg-base-100/90 shadow-sm"
                  aria-label={`Remove ${file.name}`}
                  onClick={(event: MouseEvent) => {
                    if (typeof (event as any).stopPropagation === 'function') {
                      ;(event as any).stopPropagation()
                    }
                    void handleRemove(file)
                  }}
                >
                  <DefaultRemoveIcon />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={mergeClassNames(
            'flex items-center gap-3 rounded-box border border-base-300 bg-base-100 px-3 py-3 shadow-sm',
            itemClassName,
          )}
        >
          {isPictureType(resolvedListType) ? (
            <button
              type="button"
              className="h-14 w-14 shrink-0 overflow-hidden rounded-box"
              onClick={() => void handlePreview(file)}
              disabled={disabled}
            >
              {renderFileThumb(file)}
            </button>
          ) : (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-box bg-base-200 text-base-content/65">
              {isImageLike(file) ? <DefaultImageIcon /> : <DefaultFileIcon />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{file.name}</span>
              <span
                className={mergeClassNames(
                  'badge badge-sm',
                  buildStatusBadgeClassName(file.status),
                )}
              >
                {file.status ?? 'ready'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
              {file.type ? <span>{file.type}</span> : null}
              {formatFileSize(file.size) ? <span>{formatFileSize(file.size)}</span> : null}
              {extraContent !== undefined ? <span>{extraContent}</span> : null}
            </div>
          </div>
          {(showPreviewIcon || showRemoveIcon) && !disabled ? (
            <div className="flex shrink-0 items-center gap-1">
              {showPreviewIcon ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={`Preview ${file.name}`}
                  onClick={() => void handlePreview(file)}
                >
                  <DefaultPreviewIcon />
                </button>
              ) : null}
              {showRemoveIcon ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => void handleRemove(file)}
                >
                  <DefaultRemoveIcon />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      )

    if (uploadListConfig?.itemRender) {
      return uploadListConfig.itemRender(file, defaultNode, {
        preview: () => void handlePreview(file),
        remove: () => void handleRemove(file),
      })
    }

    return defaultNode
  }

  onMounted(() => {
    syncFromProps()
    renderDynamicRegion()
  })

  const nativeInputNode = (
    <input
      {...rest}
      ref={assignInputRef}
      type="file"
      className={mergeClassNames(
        'sr-only pointer-events-none absolute h-0 w-0 opacity-0',
        className,
      )}
      disabled={disabled}
      multiple={acceptsMany}
      onChange={handleNativeChange}
      directory={directory ? '' : undefined}
      webkitdirectory={directory ? '' : undefined}
    />
  )

  const renderDefaultTriggerNode = () => {
    if (drag) {
      return (
        <div
          className={buildDropzoneClassName({
            variant,
            disabled,
            dragging: dragging.value,
            className: triggerClassName,
          })}
        >
          <div className="flex flex-col items-center text-center">
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <DefaultUploadIcon className="size-6" />
            </span>
            <div className="text-sm font-semibold text-base-content">
              {title ?? '拖拽文件到这里，或点击选择文件'}
            </div>
            <div className="mt-2 max-w-md text-sm text-base-content/65">
              {description ?? '适合资料、图片和批量附件收集；列表仍交给业务侧决定上传时机。'}
            </div>
            <div className="mt-3 text-xs text-base-content/50">
              {hint ?? (acceptsMany ? '支持多文件选择' : '单次选择一个文件')}
            </div>
          </div>
        </div>
      )
    }

    if (resolvedListType === 'picture-card') {
      return (
        <div
          className={mergeClassNames(
            'flex aspect-square flex-col items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-center shadow-sm transition',
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:border-primary/40 hover:bg-base-200/40',
            triggerClassName,
          )}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-base-content/70">
            <DefaultPlusIcon />
          </span>
          <div className="mt-3 text-sm font-medium text-base-content">
            {buttonText ?? '添加文件'}
          </div>
          <div className="mt-1 text-xs text-base-content/60">
            {hint ?? (maxCount ? `最多 ${maxCount} 个` : '支持图片或附件卡片展示')}
          </div>
        </div>
      )
    }

    return (
      <div
        className={mergeClassNames(
          'flex flex-wrap items-center gap-3 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm',
          triggerClassName,
        )}
      >
        <button
          type="button"
          className={buildTriggerButtonClassName({
            variant,
            size,
            ghost,
            className: disabled ? 'btn-disabled' : undefined,
          })}
          onClick={openPicker}
          disabled={disabled}
        >
          <DefaultUploadIcon />
          <span>{buttonText ?? '选择文件'}</span>
        </button>
        <div className="text-sm text-base-content/65">
          <div>{title ?? '保持 Rue 的轻量输入风格，同时拥有 Upload 式文件编排能力。'}</div>
          <div className="text-xs text-base-content/50">
            {hint ??
              (acceptsMany ? '可多选、可移除、可受控管理列表' : '可受控管理列表并自定义预览与删除')}
          </div>
        </div>
      </div>
    )
  }

  const renderDynamicRegion = () => {
    if (!dynamicHostRef.current) return
    const defaultTriggerNode = renderDefaultTriggerNode()
    const triggerNode = children ?? defaultTriggerNode
    const canAppendCard = maxCount ? currentFileList.value.length < maxCount : true

    renderRue(
      <>
        <div
          role={drag ? 'button' : undefined}
          tabIndex={drag && !disabled ? 0 : undefined}
          onClick={
            children
              ? openPicker
              : drag || resolvedListType === 'picture-card'
                ? openPicker
                : undefined
          }
          onKeyDown={(event: KeyboardEvent) => {
            const key = (event as any).key
            if ((key === 'Enter' || key === ' ') && !disabled) {
              if (typeof (event as any).preventDefault === 'function') {
                ;(event as any).preventDefault()
              }
              openPicker()
            }
          }}
          onDragOver={drag ? handleDragOver : undefined}
          onDragLeave={drag ? handleDragLeave : undefined}
          onDrop={drag ? handleDrop : undefined}
        >
          {triggerNode}
        </div>

        {listVisible ? (
          currentFileList.value.length > 0 ? (
            resolvedListType === 'picture-card' ? (
              <div
                className={mergeClassNames(
                  'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
                  listClassName,
                )}
              >
                {currentFileList.value.map((file, index) => (
                  <div key={file.uid || `fallback-${index}`}>{renderListItem(file)}</div>
                ))}
                {canAppendCard && !disabled ? (
                  <div
                    onClick={openPicker}
                    onKeyDown={(event: KeyboardEvent) => {
                      const key = (event as any).key
                      if (key === 'Enter' || key === ' ') {
                        if (typeof (event as any).preventDefault === 'function') {
                          ;(event as any).preventDefault()
                        }
                        openPicker()
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {children === undefined ? (
                      renderDefaultTriggerNode()
                    ) : (
                      <div
                        className={mergeClassNames(
                          'flex aspect-square flex-col items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100 p-4 text-center shadow-sm transition hover:border-primary/40 hover:bg-base-200/40',
                          triggerClassName,
                        )}
                      >
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-base-content/70">
                          <DefaultPlusIcon />
                        </span>
                        <div className="mt-3 text-sm font-medium text-base-content">
                          {buttonText ?? '继续添加'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={mergeClassNames('space-y-3', listClassName)}>
                {currentFileList.value.map((file, index) => (
                  <div key={file.uid || `fallback-${index}`}>{renderListItem(file)}</div>
                ))}
              </div>
            )
          ) : (
            <div
              className={mergeClassNames(
                'rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/55',
                listClassName,
              )}
            >
              {empty ?? '还没有文件，先选择一个文件开始。'}
            </div>
          )
        ) : null}
      </>,
      dynamicHostRef.current,
    )
  }

  watch(
    () => [listVersion.value, dragging.value],
    () => {
      renderDynamicRegion()
    },
  )

  watch(() => fileList, syncFromProps)

  return (
    <div
      className={mergeClassNames('space-y-4', rootClassName)}
      data-rue-file-input-root="true"
      data-rue-file-input-version={String(listVersion.value)}
    >
      {nativeInputNode}
      <div ref={dynamicHostRef} />
    </div>
  )
}

const Dragger: FC<FileInputProps> = props => {
  return <FileInputRoot {...props} drag />
}

const FileInput: FileInputCompound = Object.assign(FileInputRoot, {
  Dragger,
  LIST_IGNORE: FILE_INPUT_LIST_IGNORE as typeof FILE_INPUT_LIST_IGNORE,
})

export default FileInput

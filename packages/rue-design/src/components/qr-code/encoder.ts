/*
二维码编码器模块概述
- 负责把文本编码为 QR Code 矩阵，包含版本选择、纠错码生成、掩码评估和格式信息写入。
- 导出的类型描述编码入参和结果结构，内部注释标明关键算法步骤。
*/
/** QRCodeErrorCorrectionLevel 类型。 */
export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

/** EncodeQrMatrixOptions 选项配置。 */
export interface EncodeQrMatrixOptions {
  /** errorLevel 配置项。 */
  errorLevel?: QRCodeErrorCorrectionLevel
  /** boostLevel 配置项。 */
  boostLevel?: boolean
}

/** EncodedQrCode 接口。 */
export interface EncodedQrCode {
  /** version 配置项。 */
  version: number
  /** 组件尺寸。 */
  size: number
  /** 遮罩层区域配置。 */
  mask: number
  /** level 配置项。 */
  level: QRCodeErrorCorrectionLevel
  /** matrix 配置项。 */
  matrix: boolean[][]
}

/** MODE_INDICATOR_BYTE 内部常量。 */
const MODE_INDICATOR_BYTE = 0x4
/** PAD_CODEWORDS 内部常量。 */
const PAD_CODEWORDS = [0xec, 0x11] as const
/** FORMAT_BITS_BY_LEVEL 内部常量。 */
const FORMAT_BITS_BY_LEVEL: Record<QRCodeErrorCorrectionLevel, number> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
}

/** PENALTY_N1 内部常量。 */
const PENALTY_N1 = 3
/** PENALTY_N2 内部常量。 */
const PENALTY_N2 = 3
/** PENALTY_N3 内部常量。 */
const PENALTY_N3 = 40
/** PENALTY_N4 内部常量。 */
const PENALTY_N4 = 10

/** FINDER_PENALTY_PATTERNS 内部常量。 */
const FINDER_PENALTY_PATTERNS = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
] as const

/** LEVEL_ORDER 内部常量。 */
const LEVEL_ORDER: QRCodeErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']

/** ECC_CODEWORDS_PER_BLOCK 内部常量。 */
const ECC_CODEWORDS_PER_BLOCK: Record<QRCodeErrorCorrectionLevel, number[]> = {
  L: [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
    30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  Q: [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
    30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  H: [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
}

/** NUM_ERROR_CORRECTION_BLOCKS 内部常量。 */
const NUM_ERROR_CORRECTION_BLOCKS: Record<QRCodeErrorCorrectionLevel, number[]> = {
  L: [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
    15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  M: [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23,
    25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  Q: [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
    34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  H: [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35,
    37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
}

/** 创建 Matrix 的内部工具函数。 */
const createMatrix = <T>(size: number, value: T) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => value))

/** clone Matrix 的内部工具函数。 */
const cloneMatrix = (matrix: boolean[][]) => matrix.map(row => row.slice())

/** append Bits 的内部工具函数。 */
const appendBits = (buffer: number[], value: number, length: number) => {
  for (let index = length - 1; index >= 0; index -= 1) {
    buffer.push((value >>> index) & 1)
  }
}

/** 转换为 Codewords 的内部工具函数。 */
const toCodewords = (bits: number[]) => {
  const codewords: number[] = []

  for (let index = 0; index < bits.length; index += 8) {
    let value = 0

    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | (bits[index + offset] ?? 0)
    }

    codewords.push(value)
  }

  return codewords
}

/** 读取 Num Raw Data Modules 的内部工具函数。 */
const getNumRawDataModules = (version: number) => {
  let result = (16 * version + 128) * version + 64

  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55

    if (version >= 7) {
      result -= 36
    }
  }

  return result
}

/** 读取 Num Data Codewords 的内部工具函数。 */
const getNumDataCodewords = (version: number, level: QRCodeErrorCorrectionLevel) => {
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[level][version]! * NUM_ERROR_CORRECTION_BLOCKS[level][version]!
  )
}

/** choose Version 的内部工具函数。 */
const chooseVersion = (
  byteLength: number,
  requestedLevel: QRCodeErrorCorrectionLevel,
  allowBoost: boolean,
) => {
  for (let version = 1; version <= 40; version += 1) {
    const characterCountBits = version < 10 ? 8 : 16
    const requiredBits = 4 + characterCountBits + byteLength * 8
    const availableBits = getNumDataCodewords(version, requestedLevel) * 8

    if (requiredBits > availableBits) {
      continue
    }

    let resolvedLevel = requestedLevel

    if (allowBoost) {
      const startIndex = LEVEL_ORDER.indexOf(requestedLevel)

      for (let levelIndex = startIndex + 1; levelIndex < LEVEL_ORDER.length; levelIndex += 1) {
        const level = LEVEL_ORDER[levelIndex]!
        if (requiredBits <= getNumDataCodewords(version, level) * 8) {
          resolvedLevel = level
        }
      }
    }

    return { version, level: resolvedLevel }
  }

  return null
}

/** reed Solomon Multiply 的内部工具函数。 */
const reedSolomonMultiply = (x: number, y: number) => {
  let value = 0

  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 1) ^ (((value >>> 7) & 1) * 0x11d)
    if (((y >>> index) & 1) !== 0) {
      value ^= x
    }
  }

  return value & 0xff
}

/** reed Solomon Compute Divisor 的内部工具函数。 */
const reedSolomonComputeDivisor = (degree: number) => {
  const result: number[] = Array.from({ length: degree }, () => 0)
  result[degree - 1] = 1

  let root = 1

  for (let index = 0; index < degree; index += 1) {
    for (let position = 0; position < degree; position += 1) {
      result[position] = reedSolomonMultiply(result[position]!, root)
      if (position + 1 < degree) {
        result[position] ^= result[position + 1]!
      }
    }

    root = reedSolomonMultiply(root, 0x02)
  }

  return result
}

/** reed Solomon Compute Remainder 的内部工具函数。 */
const reedSolomonComputeRemainder = (data: number[], divisor: number[]) => {
  const result = divisor.map(() => 0)

  for (const datum of data) {
    const factor = datum ^ result[0]!
    result.copyWithin(0, 1)
    result[result.length - 1] = 0

    for (let index = 0; index < result.length; index += 1) {
      result[index] ^= reedSolomonMultiply(divisor[index]!, factor)
    }
  }

  return result
}

/** add Ecc And Interleave 的内部工具函数。 */
const addEccAndInterleave = (
  dataCodewords: number[],
  version: number,
  level: QRCodeErrorCorrectionLevel,
) => {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[level][version]!
  const blockEccLength = ECC_CODEWORDS_PER_BLOCK[level][version]!
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLength = Math.floor(rawCodewords / numBlocks)
  const divisor = reedSolomonComputeDivisor(blockEccLength)
  const blocks: number[][] = []

  let dataOffset = 0

  for (let blockIndex = 0; blockIndex < numBlocks; blockIndex += 1) {
    const dataLength = shortBlockLength - blockEccLength + (blockIndex < numShortBlocks ? 0 : 1)
    const data = dataCodewords.slice(dataOffset, dataOffset + dataLength)
    dataOffset += dataLength

    const ecc = reedSolomonComputeRemainder(data, divisor)
    const block = data.slice()

    if (blockIndex < numShortBlocks) {
      block.push(0)
    }

    blocks.push(block.concat(ecc))
  }

  const result: number[] = []
  const shortBlockDataLength = shortBlockLength - blockEccLength

  for (let index = 0; index < blocks[0]!.length; index += 1) {
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
      if (index !== shortBlockDataLength || blockIndex >= numShortBlocks) {
        result.push(blocks[blockIndex]![index]!)
      }
    }
  }

  return result
}

/** 读取 Alignment Pattern Positions 的内部工具函数。 */
const getAlignmentPatternPositions = (version: number) => {
  if (version === 1) {
    return [] as number[]
  }

  const numAlign = Math.floor(version / 7) + 2
  const size = version * 4 + 17
  const step =
    version === 32 ? 26 : Math.ceil((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2
  const result = [6]

  for (let position = size - 7; result.length < numAlign; position -= step) {
    result.splice(1, 0, position)
  }

  return result
}

/** draw Finder Pattern 的内部工具函数。 */
const drawFinderPattern = (
  centerX: number,
  centerY: number,
  size: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
) => {
  for (let deltaY = -4; deltaY <= 4; deltaY += 1) {
    for (let deltaX = -4; deltaX <= 4; deltaX += 1) {
      const x = centerX + deltaX
      const y = centerY + deltaY

      if (x < 0 || x >= size || y < 0 || y >= size) {
        continue
      }

      const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY))
      setFunctionModule(x, y, distance !== 2 && distance !== 4)
    }
  }
}

/** draw Alignment Pattern 的内部工具函数。 */
const drawAlignmentPattern = (
  centerX: number,
  centerY: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
) => {
  for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
    for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
      const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY))
      setFunctionModule(centerX + deltaX, centerY + deltaY, distance !== 1)
    }
  }
}

/** draw Format Bits 的内部工具函数。 */
const drawFormatBits = (
  modules: boolean[][],
  isFunction: boolean[][],
  level: QRCodeErrorCorrectionLevel,
  mask: number,
) => {
  const size = modules.length
  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    modules[y]![x] = isDark
    isFunction[y]![x] = true
  }

  let data = (FORMAT_BITS_BY_LEVEL[level] << 3) | mask
  let remainder = data

  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537)
  }

  const bits = ((data << 10) | remainder) ^ 0x5412

  for (let index = 0; index <= 5; index += 1) {
    setFunctionModule(8, index, ((bits >>> index) & 1) !== 0)
  }

  setFunctionModule(8, 7, ((bits >>> 6) & 1) !== 0)
  setFunctionModule(8, 8, ((bits >>> 7) & 1) !== 0)
  setFunctionModule(7, 8, ((bits >>> 8) & 1) !== 0)

  for (let index = 9; index < 15; index += 1) {
    setFunctionModule(14 - index, 8, ((bits >>> index) & 1) !== 0)
  }

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(size - 1 - index, 8, ((bits >>> index) & 1) !== 0)
  }

  for (let index = 8; index < 15; index += 1) {
    setFunctionModule(8, size - 15 + index, ((bits >>> index) & 1) !== 0)
  }

  setFunctionModule(8, size - 8, true)
}

/** draw Version Bits 的内部工具函数。 */
const drawVersionBits = (modules: boolean[][], isFunction: boolean[][], version: number) => {
  if (version < 7) {
    return
  }

  const size = modules.length
  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    modules[y]![x] = isDark
    isFunction[y]![x] = true
  }

  let remainder = version

  for (let index = 0; index < 12; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25)
  }

  const bits = (version << 12) | remainder

  for (let index = 0; index < 18; index += 1) {
    const bit = ((bits >>> index) & 1) !== 0
    const a = size - 11 + (index % 3)
    const b = Math.floor(index / 3)
    setFunctionModule(a, b, bit)
    setFunctionModule(b, a, bit)
  }
}

/** draw Function Patterns 的内部工具函数。 */
const drawFunctionPatterns = (
  version: number,
  modules: boolean[][],
  isFunction: boolean[][],
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
) => {
  const size = modules.length

  for (let index = 0; index < size; index += 1) {
    setFunctionModule(6, index, index % 2 === 0)
    setFunctionModule(index, 6, index % 2 === 0)
  }

  drawFinderPattern(3, 3, size, setFunctionModule)
  drawFinderPattern(size - 4, 3, size, setFunctionModule)
  drawFinderPattern(3, size - 4, size, setFunctionModule)

  const alignmentPositions = getAlignmentPatternPositions(version)

  for (let yIndex = 0; yIndex < alignmentPositions.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < alignmentPositions.length; xIndex += 1) {
      const isFinderOverlap =
        (xIndex === 0 && yIndex === 0) ||
        (xIndex === 0 && yIndex === alignmentPositions.length - 1) ||
        (xIndex === alignmentPositions.length - 1 && yIndex === 0)

      if (!isFinderOverlap) {
        drawAlignmentPattern(
          alignmentPositions[xIndex]!,
          alignmentPositions[yIndex]!,
          setFunctionModule,
        )
      }
    }
  }

  drawFormatBits(modules, isFunction, 'M', 0)
  drawVersionBits(modules, isFunction, version)
}

/** draw Codewords 的内部工具函数。 */
const drawCodewords = (dataCodewords: number[], modules: boolean[][], isFunction: boolean[][]) => {
  const size = modules.length
  let bitIndex = 0

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5
    }

    for (let verticalIndex = 0; verticalIndex < size; verticalIndex += 1) {
      const upward = ((right + 1) & 2) === 0
      const y = upward ? size - 1 - verticalIndex : verticalIndex

      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const x = right - columnOffset

        if (!isFunction[y]![x] && bitIndex < dataCodewords.length * 8) {
          const value = (dataCodewords[bitIndex >>> 3]! >>> (7 - (bitIndex & 7))) & 1
          modules[y]![x] = value !== 0
          bitIndex += 1
        }
      }
    }
  }
}

/** 读取 Mask Bit 的内部工具函数。 */
const getMaskBit = (mask: number, x: number, y: number) => {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return false
  }
}

/** apply Mask 的内部工具函数。 */
const applyMask = (modules: boolean[][], isFunction: boolean[][], mask: number) => {
  for (let y = 0; y < modules.length; y += 1) {
    for (let x = 0; x < modules.length; x += 1) {
      if (!isFunction[y]![x] && getMaskBit(mask, x, y)) {
        modules[y]![x] = !modules[y]![x]
      }
    }
  }
}

/** matches Finder Pattern 的内部工具函数。 */
const matchesFinderPattern = (modules: boolean[]) => {
  return FINDER_PENALTY_PATTERNS.some(pattern =>
    pattern.every((value, index) => value === modules[index]),
  )
}

/** 读取 Penalty Score 的内部工具函数。 */
const getPenaltyScore = (modules: boolean[][]) => {
  const size = modules.length
  let result = 0

  for (let y = 0; y < size; y += 1) {
    let runColor = modules[y]![0]!
    let runLength = 1

    for (let x = 1; x <= size; x += 1) {
      const currentColor = x < size ? modules[y]![x]! : !runColor

      if (x < size && currentColor === runColor) {
        runLength += 1
      } else {
        if (runLength >= 5) {
          result += PENALTY_N1 + (runLength - 5)
        }

        runColor = currentColor
        runLength = 1
      }
    }
  }

  for (let x = 0; x < size; x += 1) {
    let runColor = modules[0]![x]!
    let runLength = 1

    for (let y = 1; y <= size; y += 1) {
      const currentColor = y < size ? modules[y]![x]! : !runColor

      if (y < size && currentColor === runColor) {
        runLength += 1
      } else {
        if (runLength >= 5) {
          result += PENALTY_N1 + (runLength - 5)
        }

        runColor = currentColor
        runLength = 1
      }
    }
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const topLeft = modules[y]![x]!
      if (
        topLeft === modules[y]![x + 1]! &&
        topLeft === modules[y + 1]![x]! &&
        topLeft === modules[y + 1]![x + 1]!
      ) {
        result += PENALTY_N2
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x <= size - 11; x += 1) {
      const window = modules[y]!.slice(x, x + 11)
      if (matchesFinderPattern(window)) {
        result += PENALTY_N3
      }
    }
  }

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y <= size - 11; y += 1) {
      const window = Array.from({ length: 11 }, (_, index) => modules[y + index]![x]!)
      if (matchesFinderPattern(window)) {
        result += PENALTY_N3
      }
    }
  }

  let darkModules = 0

  for (const row of modules) {
    for (const cell of row) {
      if (cell) {
        darkModules += 1
      }
    }
  }

  const totalModules = size * size
  const balancePenalty =
    Math.ceil(Math.abs(darkModules * 20 - totalModules * 10) / totalModules) - 1
  result += balancePenalty * PENALTY_N4

  return result
}

/** encode Text To Bytes 的内部工具函数。 */
const encodeTextToBytes = (value: string) => {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(value))
  }

  return Array.from(encodeURIComponent(value).match(/%[0-9A-F]{2}|./gi) ?? []).map(part =>
    part.startsWith('%') ? Number.parseInt(part.slice(1), 16) : part.charCodeAt(0),
  )
}

/** encodeQrMatrix 导出函数。 */
export const encodeQrMatrix = (
  value: string,
  options: EncodeQrMatrixOptions = {},
): EncodedQrCode => {
  const bytes = encodeTextToBytes(value)
  const requestedLevel = options.errorLevel ?? 'M'
  const selected = chooseVersion(bytes.length, requestedLevel, options.boostLevel !== false)

  if (!selected) {
    throw new RangeError('QR code payload exceeds version 40 capacity')
  }

  const { version, level } = selected
  const characterCountBits = version < 10 ? 8 : 16

  if (bytes.length >= 1 << characterCountBits) {
    throw new RangeError('QR code payload is too long for byte mode')
  }

  const dataCapacity = getNumDataCodewords(version, level)
  const capacityBits = dataCapacity * 8
  const bitBuffer: number[] = []

  appendBits(bitBuffer, MODE_INDICATOR_BYTE, 4)
  appendBits(bitBuffer, bytes.length, characterCountBits)

  for (const byte of bytes) {
    appendBits(bitBuffer, byte, 8)
  }

  appendBits(bitBuffer, 0, Math.min(4, capacityBits - bitBuffer.length))

  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0)
  }

  const dataCodewords = toCodewords(bitBuffer)

  while (dataCodewords.length < dataCapacity) {
    dataCodewords.push(PAD_CODEWORDS[dataCodewords.length % 2]!)
  }

  const finalCodewords = addEccAndInterleave(dataCodewords, version, level)
  const size = version * 4 + 17
  const modules = createMatrix(size, false)
  const isFunction = createMatrix(size, false)

  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    modules[y]![x] = isDark
    isFunction[y]![x] = true
  }

  drawFunctionPatterns(version, modules, isFunction, setFunctionModule)
  drawCodewords(finalCodewords, modules, isFunction)

  let bestMask = 0
  let bestPenalty = Number.POSITIVE_INFINITY
  let bestMatrix = modules

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = cloneMatrix(modules)
    applyMask(candidate, isFunction, mask)
    drawFormatBits(candidate, isFunction, level, mask)

    const penalty = getPenaltyScore(candidate)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestMask = mask
      bestMatrix = candidate
    }
  }

  return {
    version,
    size,
    mask: bestMask,
    level,
    matrix: bestMatrix,
  }
}

import { proxy } from 'valtio'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

const maybeProxify = (v: any) => {
  if (isObject(v) && v !== null) {
    const pv = proxy(v)
    if (pv !== v) {
      return pv
    }
  }
  return v
}

type InternalProxyObject<K, V> = Map<K, V> & {
  data: Array<[K, V | undefined]>
  size: number
  toJSON: () => Map<K, V>
}

export function proxyMap<K, V>(entries?: Iterable<[K, V]> | null) {
  const map = new Map(entries ? [...entries] : [])
  const indexMap = new Map()

  const data: Array<[K, V]> = []
  map.forEach((value, key) => {
    indexMap.set(key, data.length)
    data.push([key, value])
  })

  const vObject: InternalProxyObject<K, V> = {
    data,
    get size() {
      return map.size
    },
    get(key: K) {
      const k = maybeProxify(key)
      const index = indexMap.get(k)
      if (index === undefined) {
        return undefined
      }
      return this.data[index]![1]
    },
    has(key: K) {
      return map.has(key)
    },
    set(key: K, value: V) {
      const k = maybeProxify(key)
      const v = maybeProxify(value)
      const index = indexMap.get(k)
      map.set(k, v)
      if (index !== undefined) {
        this.data[index] = [k, v]
      } else {
        indexMap.set(k, this.data.length)
        this.data.push([k, v])
      }
      return this
    },
    delete(key: K) {
      if (map.has(key)) {
        map.delete(key)
        const index = indexMap.get(key)
        this.data.splice(index, 1)
        return true
      }
      return false
    },
    clear() {
      map.clear()
      this.data.splice(0)
    },
    forEach(cb: (value: V, key: K, map: Map<K, V>) => void) {
      map.forEach((value, key, _map) => {
        cb(value, key, this)
      })
    },
    *entries(): MapIterator<[K, V]> {
      for (const [key, value] of map.entries()) {
        yield [key, value]
      }
    },
    *keys(): IterableIterator<K> {
      for (const key of map.keys()) {
        yield key
      }
    },
    *values(): IterableIterator<V> {
      for (const value of map.values()) {
        yield value
      }
    },
    [Symbol.toStringTag]: 'Map',
    [Symbol.iterator]() {
      return map[Symbol.iterator]() as any
    },
    toJSON(): Map<K, V> {
      return new Map(map)
    },
  }

  const proxiedObject = proxy(vObject)

  Object.defineProperties(vObject, {
    size: { enumerable: false },
    data: { enumerable: false },
    toJSON: { enumerable: false },
  })

  Object.seal(proxiedObject)

  return proxiedObject
}

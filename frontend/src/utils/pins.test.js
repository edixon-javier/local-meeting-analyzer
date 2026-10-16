import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PINS_KEY, loadPins, savePins, togglePin, renamePin, removePin } from './pins'

function mockStorage(impl) {
  vi.stubGlobal('localStorage', impl)
}

describe('pins', () => {
  beforeEach(() => {
    const store = {}
    mockStorage({
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fija y desfija alternando', () => {
    let pins = togglePin([], 'a.mp3')
    pins = togglePin(pins, 'b.mp3')
    expect(pins).toEqual(['b.mp3', 'a.mp3'])
    expect(togglePin(pins, 'a.mp3')).toEqual(['b.mp3'])
  })

  it('migra la fijada al renombrar y no toca las demás', () => {
    expect(renamePin(['a.mp3', 'b.mp3'], 'a.mp3', 'c.mp3')).toEqual(['c.mp3', 'b.mp3'])
    expect(renamePin(['a.mp3'], 'x.mp3', 'c.mp3')).toEqual(['a.mp3'])
  })

  it('elimina una fijada', () => {
    expect(removePin(['a.mp3', 'b.mp3'], 'a.mp3')).toEqual(['b.mp3'])
  })

  it('guarda y recupera', () => {
    expect(savePins(['a.mp3', 'a.mp3', 'b.mp3'])).toBe(true)
    expect(loadPins()).toEqual(['a.mp3', 'b.mp3'])
  })

  it('tolera datos corruptos', () => {
    localStorage.setItem(PINS_KEY, '{no es json')
    expect(loadPins()).toEqual([])
    localStorage.setItem(PINS_KEY, JSON.stringify({ a: 1 }))
    expect(loadPins()).toEqual([])
    localStorage.setItem(PINS_KEY, JSON.stringify(['a.mp3', 3, null, '']))
    expect(loadPins()).toEqual(['a.mp3'])
  })

  it('tolera un almacenamiento bloqueado', () => {
    mockStorage({
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
    })
    expect(loadPins()).toEqual([])
    expect(savePins(['a.mp3'])).toBe(false)
  })
})

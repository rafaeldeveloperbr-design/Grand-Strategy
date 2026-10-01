const AUTO_KEY = 'gs_save_autosave'
const MANUAL_PREFIX = 'gs_save_slot_'
const SETTINGS_KEY = 'gs_settings'

export interface SaveMeta {
  id: string;
  name: string;
  date: any;
  ts: number;
  year: number;
  month: number;
  day: number;
  playerTag: string;
}

function makePayload(refs: any) {
  return {
    v: 2,
    ts: Date.now(),
    date: refs.dateRef.current,
    provinces: refs.provincesRef.current,
    countries: refs.countriesRef.current,
    armies: refs.armiesRef.current,
    wars: refs.warsRef.current,
    relations: refs.diplomaticRelationsRef.current,
    recruitments: refs.recruitmentsRef.current,
    constructions: refs.buildingConstructionsRef.current,
    playerTech: refs.playerTechStateRef.current,
    botTechs: Array.from(refs.botTechStatesRef.current.entries()),
    activeBattles: refs.activeBattlesRef.current,
    meta: {
      year: refs.dateRef.current.year,
      playerTag: refs.countriesRef?.current?.find?.((c: any) => c.tag === 'IMP')?.tag || 'IMP'
    }
  }
}

export function saveGame(refs: any, slotId: string = 'autosave') {
  const key = slotId === 'autosave' ? AUTO_KEY : `${MANUAL_PREFIX}${slotId}`
  const payload = makePayload(refs)
  localStorage.setItem(key, JSON.stringify(payload))
  return payload
}

export function loadGame(slotId: string = 'autosave') {
  const key = slotId === 'autosave' ? AUTO_KEY : `${MANUAL_PREFIX}${slotId}`
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const data = JSON.parse(raw)
  data.botTechs = new Map(data.botTechs)
  return data
}

export function listSaves(): SaveMeta[] {
  const saves: SaveMeta[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    if (k.startsWith(MANUAL_PREFIX) || k === AUTO_KEY) {
      try {
        const raw = localStorage.getItem(k)!
        const data = JSON.parse(raw)
        saves.push({
          id: k === AUTO_KEY ? 'autosave' : k.replace(MANUAL_PREFIX, ''),
          name: k === AUTO_KEY ? 'Autosave' : `Save ${k.replace(MANUAL_PREFIX, '')}`,
          date: data.date,
          ts: data.ts,
          year: data.date?.year || 0,
          month: data.date?.month || 1,
          day: data.date?.day || 1,
          playerTag: data.meta?.playerTag || 'IMP'
        })

      } catch (e) {
        console.warn('Falha ao ler save:', e);
      }
    }
  }
  return saves.sort((a, b) => b.ts - a.ts)
}

export function deleteSave(slotId: string) {
  const key = slotId === 'autosave' ? AUTO_KEY : `${MANUAL_PREFIX}${slotId}`
  localStorage.removeItem(key)
}

export function clearAllSaves() {
  listSaves().forEach(s => deleteSave(s.id))
}

// settings
export function isAutoSaveEnabled() {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return true
  try { return JSON.parse(raw).autoSave ?? true } catch { return true }
}
export function setAutoSaveEnabled(v: boolean) {
  const raw = localStorage.getItem(SETTINGS_KEY)
  let s = raw ? JSON.parse(raw) : {}
  s.autoSave = v
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}
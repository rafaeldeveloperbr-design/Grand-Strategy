const SAVE_KEY = 'gs_save_v1'
const SETTINGS_KEY = 'gs_settings'

export function saveGame(refs: any) {
  try {
    const payload = {
      v: 1,
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
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch(e) { console.error('save failed', e) }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if(!raw) return null
    const data = JSON.parse(raw)
    data.botTechs = new Map(data.botTechs)
    return data
  } catch { return null }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY)
}

export function isAutoSaveEnabled(): boolean {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if(!raw) return true // padrão ligado
  try { return JSON.parse(raw).autoSave?? true } catch { return true }
}

export function setAutoSaveEnabled(v: boolean) {
  const raw = localStorage.getItem(SETTINGS_KEY)
  let settings = raw? JSON.parse(raw) : {}
  settings.autoSave = v
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
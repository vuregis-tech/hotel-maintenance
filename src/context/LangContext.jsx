import { createContext, useContext, useState } from 'react'
import th from '../locales/th'
import en from '../locales/en'

const DICT = { th, en }
const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'th')

  function setLang(l) {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  function t(key) {
    const keys = key.split('.')
    let val = DICT[lang]
    for (const k of keys) {
      if (val == null) break
      val = val[k]
    }
    return (val != null && typeof val === 'string') ? val : key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

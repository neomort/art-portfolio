import React, { useEffect, useMemo, useState, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { common, createLowlight } from 'lowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import {
  Bold as IconBold,
  Italic as IconItalic,
  Underline as IconUnderline,
  Strikethrough as IconStrikethrough,
  Highlighter as IconHighlighter,
  ChevronDown,
  Heading1,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List as IconList,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Image as IconImage,
  Code as IconCode,
  Code2 as IconCodeBlock,
  Link as IconLink,
  Unlink as IconUnlink,
  Undo2,
  Redo2,
  Table as IconTable,
  Columns3,
  Rows3,
  Trash2,
  Smile,
  MailPlus,
} from 'lucide-react'
import BrevoSignup from './extensions/BrevoSignup'

interface TipTapEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  onPickImage?: () => Promise<string> // returns a URL to insert
}

export function setHeadingIdAtPos(ed: any, pos: number, id: string): boolean {
  const { state, view } = ed
  const $from = state.doc.resolve(pos)
  for (let d = $from.depth; d >= 0; d--) {
    if (d === 0) break // depth 0 is the doc
    const node = $from.node(d)
    if (node?.type?.name === 'heading') {
      const at = $from.before(d)
      const newAttrs = { ...node.attrs, id }
      const tr = state.tr.setNodeMarkup(at, node.type, newAttrs, node.marks)
      view.dispatch(tr)
      return true
    }
  }
  return false
}

// -------- Helpers (module-scope so both Toolbar and TipTapEditor can use) --------
function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function assignHeadingIds(ed: any) {
  const { state } = ed
  let tr = state.tr
  const used = new Set<string>()
  state.doc.descendants((node: any) => {
    if (node.type?.name === 'heading' && node.attrs?.id) used.add(node.attrs.id as string)
    return true
  })
  let changed = false
  state.doc.descendants((node: any, pos: number) => {
    if (node.type?.name === 'heading' && !node.attrs?.id) {
      const base = slugify(node.textContent || 'section') || 'section'
      let id = base
      let i = 2
      while (used.has(id)) id = `${base}-${i++}`
      used.add(id)
      const newAttrs = { ...node.attrs, id }
      tr = tr.setNodeMarkup(pos, node.type, newAttrs, node.marks)
      changed = true
    }
    return true
  })
  if (changed) ed.view.dispatch(tr)
}

export function setHeadingIdAtSelection(ed: any, id: string): boolean {
  const { state, view } = ed
  const { $from } = state.selection
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    if (node?.type?.name === 'heading') {
      const pos = $from.before(d)
      const newAttrs = { ...node.attrs, id }
      const tr = state.tr.setNodeMarkup(pos, node.type, newAttrs, node.marks)
      view.dispatch(tr)
      return true
    }
  }
  return false
}

// Accessible tooltip wrapper
const Tooltip: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => {
  return (
    <div className="relative inline-flex items-center group">
      {React.cloneElement(children, { 'aria-label': label })}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 shadow z-50"
      >
        {label}
      </span>
    </div>
  )
}

// Heading dropdown control (H1 style label + chevron)
const HeadingDropdown: React.FC<{ editor: ReturnType<typeof useEditor> | null }> = ({ editor }) => {
  const [open, setOpen] = useState(false)
  if (!editor) return null
  const current = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
    ? 'H2'
    : editor.isActive('heading', { level: 3 })
    ? 'H3'
    : editor.isActive('heading', { level: 4 })
    ? 'H4'
    : 'Paragraph'
  const isHeading = editor.isActive('heading')

  const apply = (value: 'p' | 'h1' | 'h2' | 'h3' | 'h4') => {
    const level = value === 'h1' ? 1 : value === 'h2' ? 2 : value === 'h3' ? 3 : value === 'h4' ? 4 : undefined
    const chain = editor.chain().focus()
    if (level) {
      chain.toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()
    } else {
      chain.setParagraph().run()
    }

    setOpen(false)
  }

  return (
    <div className="relative">
      <Tooltip label="Headings">
        <button
          type="button"
          className={`inline-flex items-center justify-center h-8 rounded-md px-2 min-w-[44px] text-sm ${
            isHeading ? 'bg-maroon-100 text-maroon-800' : 'text-maroon-700 hover:bg-maroon-50'
          }`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-medium mr-1">{current === 'Paragraph' ? 'P' : current}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute left-0 mt-2 w-44 rounded-lg border border-maroon-200 bg-white shadow-lg z-30 p-1">
          <button type="button" className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-maroon-50" onClick={() => apply('p')}>
            <span className="font-semibold">P</span>
            <span>Paragraph</span>
          </button>
          <button type="button" className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-maroon-50" onClick={() => apply('h1')}>
            <Heading1 className="h-4 w-4" />
            <span>Heading 1</span>
          </button>
          <button type="button" className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-maroon-50" onClick={() => apply('h2')}>
            <span className="font-semibold">H2</span>
            <span>Heading 2</span>
          </button>
          <button type="button" className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-maroon-50" onClick={() => apply('h3')}>
            <span className="font-semibold">H3</span>
            <span>Heading 3</span>
          </button>
          <button type="button" className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-maroon-50" onClick={() => apply('h4')}>
            <span className="font-semibold">H4</span>
            <span>Heading 4</span>
          </button>
        </div>
      )}
    </div>
  )
}

// Table actions dropdown
const TableMenu: React.FC<{ editor: ReturnType<typeof useEditor> | null }> = ({ editor }) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  if (!editor) return null
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  const btn = (active = false) => `inline-flex items-center justify-center h-8 w-8 rounded-md ${active ? 'bg-maroon-100 text-maroon-800' : 'text-maroon-700 hover:bg-maroon-50'}`
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`inline-flex items-center justify-center h-8 rounded-md px-2 text-sm text-maroon-700 hover:bg-maroon-50`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Table"
      >
        <IconTable className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-70 ml-1" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-56 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-2">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className={btn()} title="Insert table" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setOpen(false) }}><IconTable className="h-4 w-4" /></button>
            <button type="button" className={btn()} title="Add column before" onClick={() => { editor.chain().focus().addColumnBefore().run(); setOpen(false) }}><Columns3 className="h-4 w-4" /></button>
            <button type="button" className={btn()} title="Add column after" onClick={() => { editor.chain().focus().addColumnAfter().run(); setOpen(false) }}><Columns3 className="h-4 w-4 rotate-180" /></button>
            <button type="button" className={btn()} title="Add row before" onClick={() => { editor.chain().focus().addRowBefore().run(); setOpen(false) }}><Rows3 className="h-4 w-4" /></button>
            <button type="button" className={btn()} title="Add row after" onClick={() => { editor.chain().focus().addRowAfter().run(); setOpen(false) }}><Rows3 className="h-4 w-4 rotate-180" /></button>
            <button type="button" className={btn()} title="Delete column" onClick={() => { editor.chain().focus().deleteColumn().run(); setOpen(false) }}><Columns3 className="h-4 w-4 opacity-60" /></button>
            <button type="button" className={btn()} title="Delete row" onClick={() => { editor.chain().focus().deleteRow().run(); setOpen(false) }}><Rows3 className="h-4 w-4 opacity-60" /></button>
            <button type="button" className={btn()} title="Delete table" onClick={() => { editor.chain().focus().deleteTable().run(); setOpen(false) }}><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}


// Emoji picker dropdown (lightweight, no deps)
const EmojiMenu: React.FC<{ editor: ReturnType<typeof useEditor> | null }> = ({ editor }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  if (!editor) return null
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  // Curated emoji dataset with names/keywords for decent search without extra deps
  const EMOJI_DATA: Array<{ e: string; n: string; k: string }> = [
    { e:'😀', n:'grinning face', k:'smile happy face' },
    { e:'😁', n:'beaming face with smiling eyes', k:'grin smile happy' },
    { e:'😂', n:'face with tears of joy', k:'lol joy laugh funny' },
    { e:'🤣', n:'rolling on the floor laughing', k:'rofl laugh funny joy' },
    { e:'😊', n:'smiling face with smiling eyes', k:'smile blush happy' },
    { e:'😍', n:'smiling face with heart-eyes', k:'love hearts like crush' },
    { e:'🥳', n:'partying face', k:'party celebration birthday' },
    { e:'🤔', n:'thinking face', k:'think pondering hmmm' },
    { e:'😎', n:'smiling face with sunglasses', k:'cool sun shades' },
    { e:'😇', n:'smiling face with halo', k:'angel good' },
    { e:'😉', n:'winking face', k:'wink playful' },
    { e:'🙌', n:'raising hands', k:'hooray celebrate praise' },
    { e:'👏', n:'clapping hands', k:'applause clap bravo' },
    { e:'👍', n:'thumbs up', k:'like approve ok yes' },
    { e:'👎', n:'thumbs down', k:'dislike no' },
    { e:'🔥', n:'fire', k:'lit hot trending' },
    { e:'✨', n:'sparkles', k:'shine stars magic' },
    { e:'💯', n:'hundred points', k:'100 keepit100 score' },
    { e:'✅', n:'check mark button', k:'check done complete' },
    { e:'❌', n:'cross mark', k:'x close wrong error' },
    { e:'⚠️', n:'warning', k:'alert caution' },
    { e:'📌', n:'pushpin', k:'pin pinning' },
    { e:'📎', n:'paperclip', k:'attach attachment' },
    { e:'🔗', n:'link', k:'url hyperlink' },
    { e:'💡', n:'light bulb', k:'idea insight' },
    { e:'📝', n:'memo', k:'note write document' },
    { e:'📷', n:'camera', k:'photo image picture' },
    { e:'🖼️', n:'framed picture', k:'image gallery' },
    { e:'🎯', n:'direct hit', k:'target goal focus' },
    { e:'🚀', n:'rocket', k:'launch ship deploy' },
    { e:'🛠️', n:'hammer and wrench', k:'tools build fix' },
    { e:'🔧', n:'wrench', k:'tool fix' },
    { e:'🧪', n:'test tube', k:'experiment test lab' },
    { e:'🧰', n:'toolbox', k:'tools build kit' },
    { e:'💬', n:'speech balloon', k:'chat comment talk' },
    { e:'🗣️', n:'speaking head', k:'announce speak' },
    { e:'📣', n:'megaphone', k:'announce shout' },
    { e:'🧠', n:'brain', k:'smart think idea' },
    { e:'⏱️', n:'stopwatch', k:'time timing speed' },
    { e:'⏳', n:'hourglass', k:'loading wait time' },
    { e:'📅', n:'calendar', k:'date schedule' },
    { e:'⛅', n:'sun behind cloud', k:'partly sunny weather' },
    { e:'🌙', n:'crescent moon', k:'night moon' },
    { e:'⭐', n:'star', k:'favorite rate' },
    { e:'🌟', n:'glowing star', k:'featured highlight' },
    { e:'🔍', n:'magnifying glass', k:'search find' },
    { e:'📈', n:'chart increasing', k:'growth up stats' },
    { e:'📉', n:'chart decreasing', k:'down decline stats' },
    { e:'💵', n:'money banknote', k:'cash money payment' },
    { e:'💳', n:'credit card', k:'card pay payment' },
    { e:'🏷️', n:'label', k:'tag sale' },
    { e:'📦', n:'package', k:'ship box deliver' },
    { e:'🏁', n:'chequered flag', k:'finish done' },
  ]
  const q = query.trim().toLowerCase()
  const list = (q
    ? EMOJI_DATA.filter(d => (d.e + ' ' + d.n + ' ' + d.k).toLowerCase().includes(q))
    : EMOJI_DATA
  ).slice(0, 200)
  const insert = (e: string) => {
    editor.chain().focus().insertContent(e).run()
    setOpen(false)
  }
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Emoji"
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-maroon-700 hover:bg-maroon-50"
        onClick={() => setOpen(v => !v)}
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-60 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-2">
          <input
            type="text"
            placeholder="Search…"
            className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-maroon-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="grid grid-cols-8 gap-1 max-h-44 overflow-auto">
            {list.map((d) => (
              <button
                key={d.e + d.n}
                type="button"
                className="h-8 w-8 rounded-md hover:bg-maroon-50 text-lg"
                onClick={() => insert(d.e)}
                aria-label={`Insert ${d.n}`}
              >
                {d.e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Toolbar with grouped controls and sticky positioning
const Toolbar: React.FC<{ editor: ReturnType<typeof useEditor> | null, onPickImage?: () => Promise<string> }> = ({ editor, onPickImage }) => {
  if (!editor) return null
  const btn = (active: boolean, options: { wide?: boolean } = {}) => {
    const base = 'inline-flex items-center justify-center h-8 rounded-md'
    const width = options.wide ? 'px-2 min-w-[44px]' : 'w-8'
    const palette = active ? 'bg-maroon-100 text-maroon-800' : 'text-maroon-700 hover:bg-maroon-50'
    return `${base} ${width} ${palette}`
  }
  const group = 'inline-flex items-center gap-1 rounded-lg border border-maroon-200 bg-white/90 shadow-sm px-1 py-1'
  // Local UI state for image alt editing popover
  const [altOpen, setAltOpen] = useState(false)
  const [altTemp, setAltTemp] = useState('')
  const [sizeOpen, setSizeOpen] = useState(false)
  const [sizeTemp, setSizeTemp] = useState('')
  const [sizeError, setSizeError] = useState<string | null>(null)
  // Link popover state
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTemp, setLinkTemp] = useState('')
  const linkRef = useRef<HTMLDivElement | null>(null)
  // Anchor popover state
  const [anchorOpen, setAnchorOpen] = useState(false)
  const [anchorTemp, setAnchorTemp] = useState('')
  const anchorRef = useRef<HTMLDivElement | null>(null)
  // Store the selection range at the time the Anchor popover opens
  const anchorSel = useRef<{ from: number; to: number } | null>(null)
  // ToC popover state
  const [tocOpen, setTocOpen] = useState(false)
  const tocRef = useRef<HTMLDivElement | null>(null)
  const [tocLevels, setTocLevels] = useState<{1:boolean;2:boolean;3:boolean;4:boolean}>({1:false,2:true,3:false,4:false})
  const [tocOrdered, setTocOrdered] = useState(false)
  useEffect(() => {
    if (!linkOpen) return
    const onDown = (e: MouseEvent) => {
      if (!linkRef.current) return
      if (!linkRef.current.contains(e.target as Node)) setLinkOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [linkOpen])
  const altRef = useRef<HTMLDivElement | null>(null)
  const sizeRef = useRef<HTMLDivElement | null>(null)

  // Close alt popover on outside click or Esc
  useEffect(() => {
    if (!altOpen) return
    const onDown = (e: MouseEvent) => {
      if (!altRef.current) return
      if (!altRef.current.contains(e.target as Node)) setAltOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAltOpen(false)
      if (e.key === 'Enter') {
        editor?.chain().focus().updateAttributes('image', { alt: altTemp }).run()
        setAltOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [altOpen, altTemp, editor])

  // Close image size popover on outside click or Esc, submit on Enter
  useEffect(() => {
    if (!sizeOpen) return
    const onDown = (e: MouseEvent) => {
      if (!sizeRef.current) return
      if (!sizeRef.current.contains(e.target as Node)) setSizeOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSizeOpen(false)
      if (e.key === 'Enter') {
        const normalized = normalizeSize(sizeTemp)
        if (normalized === undefined) {
          setSizeError('Enter a number optionally ending with px or %.')
          return
        }
        editor?.chain().focus().updateAttributes('image', { width: normalized ?? null }).run()
        setSizeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sizeOpen, sizeTemp, editor])

  const normalizeSize = (raw: string): string | null | undefined => {
    const value = (raw || '').trim()
    if (!value) {
      setSizeError(null)
      return null
    }
    if (/^\d+(\.\d+)?%$/.test(value)) {
      setSizeError(null)
      return value
    }
    if (/^\d+(\.\d+)?px$/.test(value)) {
      setSizeError(null)
      return value
    }
    if (/^\d+(\.\d+)?$/.test(value)) {
      setSizeError(null)
      return `${value}px`
    }
    return undefined
  }

  const applySize = (raw: string) => {
    const normalized = normalizeSize(raw)
    if (normalized === undefined) {
      setSizeError('Width must be a number optionally followed by px or %.')
      return
    }
    editor.chain().focus().updateAttributes('image', { width: normalized ?? null }).run()
    setSizeOpen(false)
  }
  // Close anchor popover on outside click or Esc
  useEffect(() => {
    if (!anchorOpen) return
    const onDown = (e: MouseEvent) => {
      if (!anchorRef.current) return
      if (!anchorRef.current.contains(e.target as Node)) setAnchorOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnchorOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchorOpen])
  // Fallback: switch to fixed when sticky fails due to ancestor overflow/transform
  const barRef = useRef<HTMLDivElement | null>(null)
  const [isFixed, setIsFixed] = useState(false)
  const [barH, setBarH] = useState(0)
  const [headerTop, setHeaderTop] = useState(0)
  const [barAbsTop, setBarAbsTop] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const computeHeaderTop = () => {
      const headerEl = document.querySelector('header') as HTMLElement | null
      const rect = headerEl?.getBoundingClientRect()
      // If header is sticky/fixed itself, bottom gives us precise offset from viewport top
      const top = rect ? Math.max(0, Math.round(rect.bottom)) : (window.innerWidth >= 768 ? 64 : 56)
      setHeaderTop(top)
    }
    const computeBarAbsTop = () => {
      if (!barRef.current) return
      // absolute top of the bar in document coordinates (position BEFORE sticking)
      const r = barRef.current.getBoundingClientRect()
      setBarAbsTop(Math.round(r.top + window.scrollY))
    }
    computeHeaderTop()
    computeBarAbsTop()
    window.addEventListener('resize', () => {
      computeHeaderTop()
      computeBarAbsTop()
    })
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (!barRef.current) return
        if (barAbsTop == null) return
        // Dynamic header offset
        const headerEl = document.querySelector('header') as HTMLElement | null
        const hdrRect = headerEl?.getBoundingClientRect()
        const headerOffset = hdrRect ? Math.max(0, Math.round(hdrRect.bottom)) : headerTop
        // Engage when the scroll surpasses the bar's natural top minus header
        const engageY = barAbsTop - headerOffset - 4
        const releaseY = engageY - 12 // small hysteresis so it releases cleanly when scrolling up
        const y = window.scrollY
        if (!isFixed && y >= engageY) {
          setBarH(barRef.current.offsetHeight)
          setIsFixed(true)
        } else if (isFixed && y <= releaseY) {
          setIsFixed(false)
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', computeHeaderTop)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isFixed, headerTop, barAbsTop])


  return (
    <div>
      {/* spacer to avoid layout jump when fixed */}
      {isFixed && <div style={{ height: barH }} />}
      <div
        ref={barRef}
        className={`${isFixed ? 'fixed left-0 right-0 z-50' : 'sticky z-50'} bg-white/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur py-1`}
        style={{ top: headerTop }}
      >
      <div className="flex flex-wrap items-center gap-2">
        {/* Headings + Color */}
        <div className={group}>
          <HeadingDropdown editor={editor} />
        </div>

        {/* Text styles */}
        <div className={group}>
          <Tooltip label="Bold"><button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><IconBold className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Italic"><button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><IconItalic className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Underline"><button type="button" className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><IconUnderline className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Strikethrough"><button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}><IconStrikethrough className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Highlight"><button type="button" className={btn(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()}><IconHighlighter className="h-4 w-4" /></button></Tooltip>
        </div>

        {/* Alignment */}
        <div className={group}>
          <Tooltip label="Align left"><button type="button" className={btn(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Align center"><button type="button" className={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Align right"><button type="button" className={btn(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Justify"><button type="button" className={btn(editor.isActive({ textAlign: 'justify' }))} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></button></Tooltip>
        </div>

        {/* Lists / Quote / Rule */}
        <div className={group}>
          <Tooltip label="Bullet list"><button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><IconList className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Ordered list"><button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Task list"><button type="button" className={btn(editor.isActive('taskList'))} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListTodo className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Quote"><button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Horizontal rule"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></button></Tooltip>
        </div>

        {/* Link / Anchor / Image / Code */}
        <div className={group}>
          <div className="relative">
            <Tooltip label="Link">
              <button
                type="button"
                className={btn(editor.isActive('link'))}
                onClick={(e) => {
                  e.stopPropagation()
                  const prev = (editor.getAttributes('link').href as string | undefined) || ''
                  setLinkTemp(prev)
                  setLinkOpen((v) => !v)
                }}
              >
                <IconLink className="h-4 w-4" />
              </button>
            </Tooltip>
            {linkOpen && (
              <div
                ref={linkRef}
                className="absolute left-0 mt-2 w-72 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-xs text-maroon-600 mb-1">Link URL</label>
                <input
                  type="url"
                  value={linkTemp}
                  onChange={(e) => setLinkTemp(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50"
                    onClick={() => setLinkOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 text-sm rounded-md border border-maroon-600 text-maroon-700 bg-white hover:bg-maroon-50 shadow-sm"
                    onClick={() => {
                      const val = linkTemp.trim()
                      if (!val) {
                        editor.chain().focus().unsetLink().run()
                      } else {
                        editor.chain().focus().setLink({ href: val }).run()
                      }
                      setLinkOpen(false)
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <Tooltip label="Heading anchor">
              <button
                type="button"
                className={btn(false)}
                onClick={(e) => {
                  e.stopPropagation()
                  // If already open, don't overwrite user's input
                  if (!anchorOpen) {
                    // suggest id from current selection text if possible
                    const { from, to } = editor.state.selection
                    anchorSel.current = { from, to }
                    const selText = editor.state.doc.textBetween(from, to, ' ')
                    const suggested = (selText || 'section')
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9_\-]+/g, '-')
                      .replace(/^-+|-+$/g, '')
                    setAnchorTemp(suggested || 'section')
                  }
                  setAnchorOpen(v => !v)
                }}
              >
                <span className="text-xs font-medium">#</span>
              </button>
            </Tooltip>
            {anchorOpen && (
              <div
                ref={anchorRef}
                className="absolute left-0 mt-2 w-72 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-xs text-maroon-600 mb-1">Anchor ID</label>
                <input
                  type="text"
                  value={anchorTemp}
                  onChange={(e) => setAnchorTemp(e.target.value.replace(/\s+/g, '-'))}
                  placeholder="section-id"
                  className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const raw = anchorTemp || ''
                      const id = raw
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9_\-]/g, '')
                        .replace(/^-+|-+$/g, '')
                      if (!id) return
                      // Always target the heading at the original selection position
                      const basePos = anchorSel.current?.from ?? editor.state.selection.from
                      if (!setHeadingIdAtPos(editor, basePos, id)) {
                        alert('Place the cursor in a heading (H1–H4) to set its anchor id.')
                      }
                      setAnchorOpen(false)
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500">Link: <code>#{anchorTemp || 'section'}</code></div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50"
                      onClick={() => setAnchorOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 text-sm rounded-md border border-maroon-600 text-maroon-700 bg-white hover:bg-maroon-50 shadow-sm"
                      onClick={() => {
                        const raw = anchorTemp || ''
                        const id = raw
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9_\-]/g, '')
                          .replace(/^-+|-+$/g, '')
                        if (!id) { return }
                        const basePos = anchorSel.current?.from ?? editor.state.selection.from
                        if (!setHeadingIdAtPos(editor, basePos, id)) {
                          alert('Place the cursor in a heading (H1–H4) to set its anchor id.')
                        }
                        setAnchorOpen(false)
                      }}
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Tooltip label="Unlink"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().unsetLink().run()}><IconUnlink className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Insert image"><button type="button" className={btn(false)} onClick={async () => {
            try { if (!onPickImage) return; const url = await onPickImage(); if (url) editor.chain().focus().setImage({ src: url, alt: '' }).run() } catch {}
          }}><IconImage className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Inline code"><button type="button" className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()}><IconCode className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Code block"><button type="button" className={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><IconCodeBlock className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Emoji"><div className="inline-flex"><EmojiMenu editor={editor} /></div></Tooltip>
          <Tooltip label="Insert newsletter signup">
            <button
              type="button"
              className={btn(editor.isActive('brevoSignup'))}
              onClick={() => editor.chain().focus().insertBrevoSignup().run()}
            >
              <MailPlus className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Import Markdown">
            <button
              type="button"
              className={btn(false)}
              onClick={async () => {
                try {
                  const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n')
                  const source = sel && sel.trim().length > 0 ? sel : editor.getText() || ''
                  if (!source.trim()) return
                  const { marked } = await import('marked')
                  const html = marked.parse(source)
                  if (sel && sel.trim().length > 0) {
                    editor.chain().focus().deleteSelection().insertContent(html).run()
                  } else {
                    editor.commands.setContent(html)
                  }
                } catch (e) {
                  console.error('Markdown import failed:', e)
                  alert('Unable to import markdown. Please ensure dependencies are installed.')
                }
              }}
            >
              <span className="text-xs font-medium">MD</span>
            </button>
          </Tooltip>
          <div className="relative">
            <Tooltip label="Insert ToC">
              <button
                type="button"
                className={btn(false)}
                onClick={(e) => { e.stopPropagation(); setTocOpen(v => !v) }}
              >
                <span className="text-xs font-medium">ToC</span>
              </button>
            </Tooltip>
            {tocOpen && (
              <div
                ref={tocRef}
                className="absolute left-0 mt-2 w-64 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-sm font-medium text-maroon-800 mb-2">Table of Contents</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tocLevels[1]} onChange={e => setTocLevels(v => ({...v, 1:e.target.checked}))} /> H1</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tocLevels[2]} onChange={e => setTocLevels(v => ({...v, 2:e.target.checked}))} /> H2</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tocLevels[3]} onChange={e => setTocLevels(v => ({...v, 3:e.target.checked}))} /> H3</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tocLevels[4]} onChange={e => setTocLevels(v => ({...v, 4:e.target.checked}))} /> H4</label>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={tocOrdered} onChange={e => setTocOrdered(e.target.checked)} /> Ordered list</label>
                  <div className="flex gap-2">
                    <button type="button" className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50" onClick={() => setTocOpen(false)}>Cancel</button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 text-sm rounded-md border border-maroon-600 text-maroon-700 bg-white hover:bg-maroon-50 shadow-sm"
                      onClick={() => {
                        const allowed = new Set<number>([1,2,3,4].filter(l => (tocLevels as any)[l]))
                        const items: { level: number; id: string; text: string }[] = []
                        editor.state.doc.descendants((node) => {
                          if (node.type.name === 'heading') {
                            const id = (node.attrs as any).id as string | undefined
                            const text = (node.textContent || '').trim()
                            const level = (node.attrs as any).level || 1
                            if (id && text && allowed.has(level)) items.push({ level, id, text })
                          }
                        })
                        if (items.length === 0) { setTocOpen(false); return }
                        const tag = tocOrdered ? 'ol' : 'ul'
                        const html = `<${tag}>${items.map(i => `<li><a href=\"#${i.id}\">${i.text}</a></li>`).join('')}</${tag}>`
                        editor.chain().focus().insertContent(html).run()
                        setTocOpen(false)
                      }}
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image formatting */}
        <div className={group}>
          <Tooltip label="Image: align left"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateAttributes('image', { align: 'left' }).run()}><AlignLeft className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Image: center"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateAttributes('image', { align: 'center' }).run()}><AlignCenter className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Image: align right"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateAttributes('image', { align: 'right' }).run()}><AlignRight className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Image: full width"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateAttributes('image', { align: 'full' }).run()}><span className="text-xs font-medium">100%</span></button></Tooltip>
          <div className="relative">
            <Tooltip label="Image: size">
              <button
                type="button"
                className={btn(false, { wide: true })}
                onClick={(e) => {
                  e.stopPropagation()
                  setAltOpen(false)
                  if (!sizeOpen) {
                    const widthPrev = (editor.getAttributes('image').width as string | undefined) || ''
                    setSizeTemp(widthPrev)
                    setSizeError(null)
                  }
                  setSizeOpen((v) => !v)
                }}
              >
                <span className="text-xs font-medium">Size</span>
                <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
              </button>
            </Tooltip>
            {sizeOpen && (
              <div
                ref={sizeRef}
                className="absolute left-0 mt-2 w-72 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-sm font-medium text-maroon-800 mb-2">Image width</div>
                <label className="block text-xs text-maroon-600 mb-1">Custom</label>
                <input
                  type="text"
                  value={sizeTemp}
                  onChange={(e) => setSizeTemp(e.target.value)}
                  autoFocus
                  placeholder="e.g. 300px or 50%"
                  className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
                {sizeError ? <div className="mt-1 text-xs text-red-600">{sizeError}</div> : null}
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  {['Original', '25%', '50%', '75%', '100%'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="px-2 py-1 rounded-md border border-maroon-200 hover:bg-maroon-50"
                      onClick={() => {
                        if (label === 'Original') {
                          applySize('')
                        } else {
                          applySize(label)
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50"
                    onClick={() => setSizeOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 text-sm rounded-md border border-maroon-600 text-maroon-700 bg-white hover:bg-maroon-50 shadow-sm"
                    onClick={() => applySize(sizeTemp)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <Tooltip label="Image: alt text">
              <button
                type="button"
                className={btn(false)}
                onClick={(e) => {
                e.stopPropagation()
                const altPrev = (editor.getAttributes('image').alt as string | undefined) || ''
                setAltTemp(altPrev)
                setAltOpen((v) => !v)
                }}
              >
                <span className="text-xs">Alt</span>
              </button>
            </Tooltip>
            {altOpen && (
              <div
                ref={altRef}
                className="absolute left-0 mt-2 w-64 rounded-lg border border-maroon-200 bg-white shadow-lg z-50 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-xs text-maroon-600 mb-1">Alt text</label>
                <input
                  type="text"
                  value={altTemp}
                  onChange={(e) => setAltTemp(e.target.value)}
                  autoFocus
                  className="w-full border border-maroon-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 text-sm rounded-md border border-maroon-200 hover:bg-maroon-50"
                    onClick={() => {
                      setAltOpen(false)
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 text-sm rounded-md border border-maroon-600 text-maroon-700 bg-white hover:bg-maroon-50 shadow-sm"
                    onClick={() => {
                      editor.chain().focus().updateAttributes('image', { alt: altTemp }).run()
                      setAltOpen(false)
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Undo / Redo / Clear */}
        <div className={group}>
          <Tooltip label="Undo"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Redo"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></button></Tooltip>
          <Tooltip label="Clear formatting"><button type="button" className={btn(false)} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Trash2 className="h-4 w-4" /></button></Tooltip>
        </div>

        {/* Table controls */}
        <div className={group}>
          <Tooltip label="Table actions"><div className="inline-flex"><TableMenu editor={editor} /></div></Tooltip>
        </div>
      </div>
      </div>
    </div>
  )
}

const TipTapEditor: React.FC<TipTapEditorProps> = ({ value, onChange, placeholder, onPickImage }) => {
  // Build stable extension instances (avoid duplicate warnings in StrictMode/HMR)
  const ll = useMemo(() => createLowlight(common), [])
  const extensions = useMemo(() => [
    StarterKit.configure({
      codeBlock: false, // we'll use CodeBlockLowlight instead
      heading: false,   // custom heading with id attribute support
      link: false,      // custom link configuration below
      underline: false, // avoid duplicate registration
    }),
    // Extend Heading to support an 'id' attribute for anchors/ToC
    Heading.extend({
      addAttributes() {
        return {
          id: {
            default: null,
            parseHTML: element => element.getAttribute('id'),
            renderHTML: attributes => ({ id: attributes.id }),
          },
        }
      },
    }),
    Underline,
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: 'https://',
      HTMLAttributes: {
        target: '_self',
        rel: 'noopener',
      },
    }),
    // Extended Image with alignment/width/alt support
    Image.extend({
      addAttributes() {
        return {
          src: { default: null },
          alt: { default: '' },
          title: { default: null },
          align: { default: 'none' }, // 'none' | 'left' | 'center' | 'right' | 'full'
          width: { default: null },
        }
      },
      renderHTML({ HTMLAttributes }) {
        const attrs: any = { ...HTMLAttributes }
        const align = attrs.align
        // Apply inline styles for alignment/width so it works without external CSS
        let style = attrs.style ? String(attrs.style) : ''
        if (align === 'left') style += 'float:left;margin:0 1rem 1rem 0;'
        else if (align === 'right') style += 'float:right;margin:0 0 1rem 1rem;'
        else if (align === 'center') style += 'display:block;margin-left:auto;margin-right:auto;'
        else if (align === 'full') style += 'display:block;width:100%;height:auto;'
        if (attrs.width) style += `width:${attrs.width};`
        if (style) attrs.style = style
        return ['img', attrs]
      },
    }) as any,
    Placeholder.configure({ placeholder: placeholder || 'Write your content…' }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight,
    Color,
    TaskList,
    TaskItem,
    CodeBlockLowlight.configure({ lowlight: ll }),
    BrevoSignup,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
  ], [placeholder])

  // Helpers defined BEFORE editor so they're in scope for onUpdate
  function slugify(text: string): string {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_\-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function assignHeadingIds(ed: any) {
    const { state } = ed
    let tr = state.tr
    const used = new Set<string>()
    // collect existing ids first
    state.doc.descendants((node: any) => {
      if (node.type?.name === 'heading' && node.attrs?.id) used.add(node.attrs.id as string)
      return true
    })
    let changed = false
    state.doc.descendants((node: any, pos: number) => {
      if (node.type?.name === 'heading' && !node.attrs?.id) {
        const base = slugify(node.textContent || 'section') || 'section'
        let id = base
        let i = 2
        while (used.has(id)) id = `${base}-${i++}`
        used.add(id)
        const newAttrs = { ...node.attrs, id }
        tr = tr.setNodeMarkup(pos, node.type, newAttrs, node.marks)
        changed = true
      }
      return true
    })
    if (changed) ed.view.dispatch(tr)
  }

  const editor = useEditor({
    extensions,
    content: value || '',
    onUpdate({ editor }) {
      // Assign IDs to headings that don't have one yet
      assignHeadingIds(editor)
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap prose max-w-none focus:outline-none',
      },
    },
  })

  // keep editor content in sync if value prop changes externally
  useEffect(() => {
    if (!editor) return
    const html = editor.getHTML()
    if (value !== html) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  return (
    <div className="space-y-2">
      <Toolbar editor={editor} onPickImage={onPickImage} />
      <div className="border-2 border-maroon-100 rounded-2xl bg-white overflow-hidden">
        <div className="min-h-[7.5rem] max-h-[50vh] overflow-y-auto p-4">
          <EditorContent editor={editor} className="min-h-[5.5rem]" />
        </div>
        <div className="h-2 bg-maroon-50 border-t border-maroon-100 cursor-ns-resize" 
             onMouseDown={(e) => {
               e.preventDefault();
               const startY = e.clientY;
               const startHeight = e.currentTarget.previousElementSibling?.scrollHeight || 0;
               const minHeight = 7.5 * 16; // 7.5rem in pixels
               
               const onMouseMove = (moveEvent: MouseEvent) => {
                 const newHeight = startHeight + (moveEvent.clientY - startY);
                 if (e.currentTarget.previousElementSibling) {
                   (e.currentTarget.previousElementSibling as HTMLElement).style.height = 
                     `${Math.max(newHeight, minHeight)}px`;
                 }
               };
               
               const onMouseUp = () => {
                 document.removeEventListener('mousemove', onMouseMove);
                 document.removeEventListener('mouseup', onMouseUp);
               };
               
               document.addEventListener('mousemove', onMouseMove);
               document.addEventListener('mouseup', onMouseUp);
             }}
        >
          <div className="h-full w-12 mx-auto flex items-center justify-center">
            <div className="h-1 w-8 bg-maroon-200 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TipTapEditor

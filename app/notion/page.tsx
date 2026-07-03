'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { dbLoadLatestBlockPage, dbUpdateBlockPage, dbCreateBlockPage } from '@/lib/db'
import type { Block } from '@blocknote/core'

// ─── editor (mounted only after content is loaded) ────────────────────────────

function NotionEditor({
  initialBlocks,
  pageId,
}: {
  initialBlocks: Block[]
  pageId: string | null
}) {
  const pageIdRef = useRef(pageId)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saving, setSaving] = useState(false)

  const editor = useCreateBlockNote({
    initialContent: initialBlocks.length > 0 ? initialBlocks : undefined,
  })

  const save = useCallback(async (blocks: Block[]) => {
    setSaving(true)
    try {
      if (pageIdRef.current) {
        await dbUpdateBlockPage(pageIdRef.current, blocks)
      } else {
        const id = await dbCreateBlockPage(blocks)
        if (id) pageIdRef.current = id
      }
    } finally {
      setSaving(false)
    }
  }, [])

  function handleChange() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(editor.document as Block[]), 1200)
  }

  return (
    <div className="notion-editor-wrap">
      <div
        className="text-[10px] uppercase tracking-wider mb-4 text-right"
        style={{ color: 'rgba(200,169,110,0.5)' }}
      >
        {saving ? 'kaydediliyor…' : 'otomatik kayıt açık'}
      </div>
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={handleChange}
      />
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function NotionPage() {
  const [status, setStatus]           = useState<'loading' | 'ready'>('loading')
  const [initialBlocks, setInitialBlocks] = useState<Block[]>([])
  const [pageId, setPageId]           = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await dbLoadLatestBlockPage()
        if (data) {
          setPageId(data.id)
          setInitialBlocks((data.content as Block[]) ?? [])
        }
      } catch {
        // ignore, show empty editor
      } finally {
        setStatus('ready')
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#0B0F14' }}>

      {/* sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-8 py-4 border-b"
        style={{ background: '#0B0F14', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <Link
          href="/dashboard"
          className="text-[11px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-70"
          style={{ color: '#c8a96e' }}
        >
          ← Dashboard
        </Link>
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="font-display text-base font-semibold text-white/90">
          Notion Sandbox
        </span>
        <span
          className="ml-2 text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider"
          style={{ color: '#c8a96e', borderColor: 'rgba(200,169,110,0.3)', background: 'rgba(200,169,110,0.08)' }}
        >
          deneysel
        </span>
      </div>

      {/* editor area */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {status === 'loading' ? (
          <div className="flex items-center justify-center py-40">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
              İçerik yükleniyor…
            </span>
          </div>
        ) : (
          <NotionEditor initialBlocks={initialBlocks} pageId={pageId} />
        )}
      </div>

      <style>{`
        .notion-editor-wrap .bn-editor {
          background: #0B0F14 !important;
          color: #e2e8f0 !important;
          padding: 0;
        }
        .notion-editor-wrap .bn-editor [data-level] {
          color: #f1f5f9;
        }
        .notion-editor-wrap .bn-slash-menu,
        .notion-editor-wrap .bn-formatting-toolbar,
        .notion-editor-wrap .bn-side-menu {
          background: #121821 !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #e2e8f0 !important;
        }
        .notion-editor-wrap .bn-slash-menu-item:hover,
        .notion-editor-wrap .bn-formatting-toolbar button:hover {
          background: rgba(200,169,110,0.12) !important;
        }
        .notion-editor-wrap .bn-drag-handle-button:hover,
        .notion-editor-wrap .bn-add-block-button:hover {
          color: #c8a96e !important;
        }
      `}</style>
    </div>
  )
}

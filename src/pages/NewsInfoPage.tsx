import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { FileText, Loader2 } from 'lucide-react'

interface PageRow {
  title: string
  slug: string
  type: string
  created_at: string | null
  updated_at: string | null
}

const formatDate = (iso?: string | null) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  } catch {
    return ''
  }
}

const NewsInfoPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PageRow[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('pages')
          .select('title, slug, type, created_at, updated_at')
          .in('type', ['News', 'Information'])
          .order('created_at', { ascending: false })
        if (error) throw error
        setRows(data || [])
      } catch (e) {
        console.error('Failed to load news & info:', e)
        setError(e instanceof Error ? e.message : 'Failed to load content')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-[#FEFAF8] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[60rem]">
        <h1 className="text-4xl font-bold text-maroon-800 mb-8 font-display text-center">News & Info</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-maroon-600">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-70" />
              No News or Information posts yet.
            </div>
          ) : (
            <ul className="divide-y divide-maroon-100">
              {rows.map((r) => {
                const published = r.created_at || r.updated_at
                return (
                  <li key={r.slug} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-semibold text-maroon-900">
                          <Link to={`/${r.slug}`} className="hover:underline">
                            {r.title}
                          </Link>
                        </h2>
                        <div className="mt-1 text-sm text-maroon-600 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-maroon-200 px-2 py-0.5 text-xs text-maroon-700 bg-maroon-50">
                            {r.type}
                          </span>
                          {published && (
                            <span aria-label="Published on">{formatDate(published)}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Link to={`/${r.slug}`} className="text-maroon-700 hover:text-maroon-900 text-sm">
                          Read more →
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default NewsInfoPage

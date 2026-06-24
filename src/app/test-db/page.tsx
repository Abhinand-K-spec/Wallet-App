'use client'

import { useEffect, useState, startTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

interface TestItem {
  id: number
  created_at: string
  name: string
}

export default function TestDbPage() {
  const [supabase] = useState(() => createClient())
  
  // Status check variables
  const [urlExists, setUrlExists] = useState(false)
  const [keyExists, setKeyExists] = useState(false)
  
  // App states
  const [testName, setTestName] = useState('')
  const [isInserting, setIsInserting] = useState(false)
  const [insertSuccess, setInsertSuccess] = useState<boolean | null>(null)
  const [insertMessage, setInsertMessage] = useState('')
  
  const [tests, setTests] = useState<TestItem[]>([])
  const [isLoadingTests, setIsLoadingTests] = useState(true)
  const [testsError, setTestsError] = useState('')

  // Verify env variables exist client-side
  useEffect(() => {
    setUrlExists(!!process.env.NEXT_PUBLIC_SUPABASE_URL)
    setKeyExists(!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }, [])

  // Fetch tests from Supabase
  const fetchTests = async () => {
    setIsLoadingTests(true)
    setTestsError('')
    try {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setTestsError(error.message)
      } else {
        setTests(data || [])
      }
    } catch (err: any) {
      setTestsError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoadingTests(false)
    }
  }

  useEffect(() => {
    fetchTests()
  }, [])

  // Handle inserting test
  const handleInsert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testName.trim()) return

    setIsInserting(true)
    setInsertSuccess(null)
    setInsertMessage('')

    try {
      const { data, error } = await supabase
        .from('tests')
        .insert([{ name: testName.trim() }])
        .select()

      if (error) {
        setInsertSuccess(false)
        setInsertMessage(error.message)
      } else {
        setInsertSuccess(true)
        setInsertMessage('Successfully inserted record!')
        setTestName('')
        // Refresh list
        fetchTests()
      }
    } catch (err: any) {
      setInsertSuccess(false)
      setInsertMessage(err.message || 'Failed to insert.')
    } finally {
      setIsInserting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <main className="w-full max-w-4xl z-10 flex flex-col gap-8 md:my-12">
        <header className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Connection Test Suite
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mt-1 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Interactive Test Console
          </h1>
          <p className="text-zinc-400 text-sm">
            Verify write and read functionality in your Supabase project. Make sure you have created the <code className="text-zinc-300 font-mono bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">tests</code> table.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT PANEL: Configuration & Form */}
          <div className="flex flex-col gap-8">
            {/* Environment variables checklist */}
            <section className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl shadow-black/40">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                Environment Configuration
              </h2>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-mono text-zinc-500">NEXT_PUBLIC_SUPABASE_URL</span>
                    <span className="text-xs font-medium text-zinc-400 font-mono truncate max-w-[200px]">
                      {urlExists ? process.env.NEXT_PUBLIC_SUPABASE_URL : 'Not configured'}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                    urlExists ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {urlExists ? 'Configured' : 'Missing'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-mono text-zinc-500">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                    <span className="text-xs font-medium text-zinc-400 font-mono">
                      {keyExists ? '••••••••••••••••••••••••••••••••' : 'Not configured'}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${
                    keyExists ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {keyExists ? 'Configured' : 'Missing'}
                  </span>
                </div>
              </div>
            </section>

            {/* Input Form */}
            <section className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl shadow-black/40">
              <h2 className="text-lg font-medium text-white">Create Test Record</h2>
              <form onSubmit={handleInsert} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="test-name" className="text-xs font-medium text-zinc-400">
                    Test Name
                  </label>
                  <input
                    id="test-name"
                    type="text"
                    placeholder="Enter test record name..."
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    disabled={isInserting}
                    className="px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInserting || !testName.trim()}
                  className="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium text-white transition shadow-lg shadow-emerald-950/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isInserting ? (
                    <>
                      <svg className="animate-spin h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Inserting...
                    </>
                  ) : (
                    'Save to Supabase'
                  )}
                </button>
              </form>

              {/* Status Message */}
              {insertSuccess !== null && (
                <div className={`p-4 rounded-xl border text-sm flex flex-col gap-1 ${
                  insertSuccess 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  <span className="font-semibold">{insertSuccess ? 'Success' : 'Error'}</span>
                  <span>{insertMessage}</span>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT PANEL: Tests Listing */}
          <section className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl shadow-black/40 min-h-[300px]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Stored Test Records</h2>
              <button 
                onClick={fetchTests}
                disabled={isLoadingTests}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
                title="Refresh items"
              >
                <svg className={`h-4.5 w-4.5 ${isLoadingTests ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
              </button>
            </div>

            {isLoadingTests ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12 text-zinc-500">
                <svg className="animate-spin h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Loading test records...</span>
              </div>
            ) : testsError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-xl border border-red-950/20 bg-red-950/10 text-center gap-2">
                <span className="text-red-400 font-semibold text-sm">Failed to retrieve records</span>
                <p className="text-xs text-red-500/80 font-mono leading-relaxed max-w-[280px] break-words">
                  {testsError}
                </p>
                <button 
                  onClick={fetchTests}
                  className="mt-2 text-xs font-semibold bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-lg text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : tests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
                <p className="text-zinc-500 text-sm font-medium">No test records found.</p>
                <p className="text-xs text-zinc-600 max-w-[200px] mt-1">
                  Create a new record in the form on the left to test database writes.
                </p>
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto max-h-[360px] pr-1 flex flex-col gap-2">
                {tests.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md">
                      ID: {item.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex gap-4 mt-4">
          <Link 
            href="/"
            className="flex-1 text-center py-3.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all text-sm cursor-pointer"
          >
            Back to Home
          </Link>
          <a
            href="https://supabase.com/docs"
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center py-3.5 px-5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all text-sm cursor-pointer"
          >
            Supabase Docs
          </a>
        </div>
      </main>
    </div>
  )
}

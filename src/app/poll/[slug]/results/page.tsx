'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Poll, PollOption } from '@/types/poll'

interface OptionWithVotes extends PollOption {
  vote_count: number
}

export default function ResultsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<OptionWithVotes[]>([])
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState('')

  const loadResults = async (pollId: string) => {
    const { data: opts } = await supabase
      .from('poll_options')
      .select('*')
      .eq('poll_id', pollId)

    if (!opts) return

    const withVotes: OptionWithVotes[] = await Promise.all(
      opts.map(async (opt) => {
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('option_id', opt.id)

        return { ...opt, vote_count: count || 0 }
      })
    )

    withVotes.sort((a, b) => b.vote_count - a.vote_count)
    setOptions(withVotes)
  }

  useEffect(() => {
    const load = async () => {
      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!pollData) {
        setLoading(false)
        return
      }

      setPoll(pollData)
      await loadResults(pollData.id)
      setShareUrl(`${window.location.origin}/poll/${slug}`)
      setLoading(false)

      // Realtime subscription
      const channel = supabase
        .channel(`votes-${pollData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'votes',
            filter: `poll_id=eq.${pollData.id}`,
          },
          () => {
            loadResults(pollData.id)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    load()
  }, [slug])

  const closePoll = async () => {
    if (!poll) return
    await supabase.from('polls').update({ is_open: false }).eq('id', poll.id)
    setPoll({ ...poll, is_open: false })
  }

  const reopenPoll = async () => {
    if (!poll) return
    await supabase.from('polls').update({ is_open: true }).eq('id', poll.id)
    setPoll({ ...poll, is_open: true })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    alert('Link copiado!')
  }

  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0)

  if (loading) return <div className="container"><p>Carregando...</p></div>
  if (!poll) return <div className="container"><p>Votação não encontrada.</p></div>

  return (
    <div className="container">
      <h1>{poll.title}</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className="btn-secondary" onClick={copyLink} style={{ flex: 1 }}>
          Copiar link de votação
        </button>
        {poll.is_open ? (
          <button className="btn-danger" onClick={closePoll} style={{ flex: 1 }}>
            Encerrar votação
          </button>
        ) : (
          <button onClick={reopenPoll} style={{ flex: 1 }}>
            Reabrir votação
          </button>
        )}
      </div>

      {!poll.is_open && (
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>Votação encerrada</p>
      )}

      <p style={{ color: '#888', marginBottom: '1rem' }}>
        {totalVotes} voto{totalVotes !== 1 ? 's' : ''} no total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {options.map((opt) => {
          const pct = totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0
          return (
            <div key={opt.id} style={{ background: '#1a1a1a', borderRadius: '8px', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${pct}%`,
                  background: '#6366f133',
                  transition: 'width 0.5s ease',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                <span>{opt.text}</span>
                <span style={{ color: '#6366f1', fontWeight: 600 }}>
                  {opt.vote_count} ({pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

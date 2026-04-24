'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import type { Poll, PollOption } from '@/types/poll'

interface OptionWithVotes extends PollOption {
  vote_count: number
}

export default function ResultsPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<OptionWithVotes[]>([])
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState('')

  const [toast, setToast] = useState(false)

  const showToast = () => {
    setToast(true)
    setTimeout(() => setToast(false), 2500)
  }

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
      const channelName = `votes-${pollData.id}`
      supabase.removeChannel(supabase.channel(channelName))
      
      const channel = supabase
        .channel(channelName)
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
    showToast()
  }

  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0)

  if (loading) return <div className="card" style={{ textAlign: 'center', color: '#555' }}>Carregando...</div>
  if (!poll) return <div className="card" style={{ textAlign: 'center' }}><p style={{ color: '#888' }}>Votação não encontrada.</p></div>

  return (
    <div className="card">
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#22c55e', color: '#fff', padding: '0.65rem 1.25rem',
          borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100,
          animation: 'fadeIn 0.2s ease',
        }}>
          ✓ Link copiado!
        </div>
      )}
      <p className="label">{poll.is_open ? '🟢 Ao vivo' : '🔒 Encerrada'}</p>
      <h1>{poll.title}</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className="btn-secondary" onClick={copyLink} style={{ flex: 1, fontSize: '0.85rem' }}>
          📋 Copiar link
        </button>
        {poll.is_open ? (
          <button className="btn-danger" onClick={closePoll} style={{ flex: 1, fontSize: '0.85rem' }}>
            Encerrar
          </button>
        ) : (
          <button onClick={reopenPoll} style={{ flex: 1, fontSize: '0.85rem' }}>
            Reabrir
          </button>
        )}
      </div>

      {!poll.is_open && (
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Votação encerrada</p>
          {options.length > 0 && totalVotes > 0 ? (
            <>
              <p style={{ color: '#555', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Vencedor</p>
              <p style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0.25rem 0' }}>
                🏆 {options[0].text}
              </p>
              <p style={{ color: '#6366f1', fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem' }}>
                {options[0].vote_count} voto{options[0].vote_count !== 1 ? 's' : ''} · {((options[0].vote_count / totalVotes) * 100).toFixed(1)}%
              </p>
            </>
          ) : (
            <p style={{ color: '#555' }}>Nenhum voto registrado</p>
          )}
          <button onClick={() => router.push('/')} style={{ marginTop: '1.25rem', padding: '0.75rem' }}>
            Criar nova votação →
          </button>
        </div>
      )}

      <p style={{ color: '#444', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {options.map((opt, i) => {
          const pct = totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0
          const isWinner = !poll.is_open && i === 0 && totalVotes > 0
          return (
            <div key={opt.id} style={{
              background: '#0d0d16',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              position: 'relative',
              overflow: 'hidden',
              border: isWinner ? '1px solid rgba(99,102,241,0.4)' : '1px solid #1e1e2e',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${pct}%`,
                background: isWinner ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)',
                transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: isWinner ? '#fff' : '#bbb', fontWeight: isWinner ? 600 : 400 }}>
                  {isWinner && '🏆 '}{opt.text}
                </span>
                <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                  {opt.vote_count} · {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

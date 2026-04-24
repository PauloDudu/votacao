'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Poll, PollOption } from '@/types/poll'

interface OptionWithVotes extends PollOption {
  vote_count: number
}

export default function VotePage() {
  const { slug } = useParams<{ slug: string }>()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<PollOption[]>([])
  const [results, setResults] = useState<OptionWithVotes[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadResults = useCallback(async (pollId: string) => {
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
    setResults(withVotes)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!pollData) { setLoading(false); return }

      setPoll(pollData)

      const { data: opts } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollData.id)

      setOptions(opts || [])

      const voterId = getVoterId()
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('poll_id', pollData.id)
        .eq('voter_id', voterId)
        .maybeSingle()

      if (existingVote) setVoted(true)
      setLoading(false)
    }
    load()
  }, [slug])

  // Realtime: status da votação (pra todos)
  useEffect(() => {
    if (!poll) return

    const statusChannel = `poll-status-${poll.id}`
    supabase.removeChannel(supabase.channel(statusChannel))

    const channel = supabase
      .channel(statusChannel)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `id=eq.${poll.id}`,
      }, (payload) => {
        const updated = payload.new as Poll
        setPoll((prev) => prev ? { ...prev, is_open: updated.is_open } : prev)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [poll?.id])

  // Realtime: votos (só depois de votar)
  useEffect(() => {
    if (!poll || !voted) return

    loadResults(poll.id)

    const votesChannel = `voter-votes-${poll.id}`
    supabase.removeChannel(supabase.channel(votesChannel))

    const channel = supabase
      .channel(votesChannel)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'votes',
        filter: `poll_id=eq.${poll.id}`,
      }, () => loadResults(poll.id))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [poll?.id, poll?.is_open, voted, loadResults])

  // Carregar resultados quando encerrar (pra quem não votou)
  useEffect(() => {
    if (!poll || poll.is_open || voted) return
    loadResults(poll.id)
  }, [poll?.is_open, poll?.id, voted, loadResults])

  const getVoterId = (): string => {
    let id = localStorage.getItem('voter_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('voter_id', id) }
    return id
  }

  const submitVote = async () => {
    if (!selected || !poll) return
    setSubmitting(true)
    const { error } = await supabase.from('votes').insert({
      option_id: selected,
      poll_id: poll.id,
      voter_id: getVoterId(),
    })
    if (error) alert('Erro ao votar. Talvez você já tenha votado.')
    else setVoted(true)
    setSubmitting(false)
  }

  const totalVotes = results.reduce((sum, o) => sum + o.vote_count, 0)

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', color: '#555' }}>Carregando...</div>
  )

  if (!poll) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
      <p style={{ color: '#888' }}>Votação não encontrada.</p>
    </div>
  )

  // Votação encerrada (sem ter votado)
  if (!poll.is_open && !voted) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
      <h1 style={{ marginBottom: '0.5rem' }}>{poll.title}</h1>
      <p style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>Votação encerrada</p>
      {results.length > 0 && totalVotes > 0 && (
        <div style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1rem',
        }}>
          <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Vencedor</p>
          <p style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>🏆 {results[0].text}</p>
          <p style={{ color: '#6366f1', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
            {results[0].vote_count} voto{results[0].vote_count !== 1 ? 's' : ''} · {((results[0].vote_count / totalVotes) * 100).toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  )

  // Já votou — mostra resultados em tempo real
  if (voted) {
    const isClosed = !poll.is_open

    return (
      <div className="card">
        <p className="label">{isClosed ? '🔒 Encerrada' : '🟢 Ao vivo'}</p>
        <h1>{poll.title}</h1>

        <p style={{ color: '#6366f1', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
          ✅ Seu voto foi registrado
        </p>

        {isClosed && results.length > 0 && totalVotes > 0 && (
          <div style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
          }}>
            <p style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Resultado final
            </p>
            <p style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>
              🏆 {results[0].text}
            </p>
            <p style={{ color: '#6366f1', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {results[0].vote_count} voto{results[0].vote_count !== 1 ? 's' : ''} · {((results[0].vote_count / totalVotes) * 100).toFixed(1)}%
            </p>
          </div>
        )}

        <p style={{ color: '#444', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {results.map((opt, i) => {
            const pct = totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0
            const isWinner = isClosed && i === 0 && totalVotes > 0
            return (
              <div key={opt.id} style={{
                background: '#0d0d16',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
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
                  <span style={{ color: '#6366f1', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
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

  // Ainda não votou — tela de votação
  return (
    <div className="card">
      <p className="label">Votação</p>
      <h1>{poll.title}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {options.map((opt) => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.9rem 1rem',
              background: selected === opt.id ? 'rgba(99,102,241,0.12)' : '#0d0d16',
              borderRadius: '10px',
              border: selected === opt.id ? '1px solid #6366f1' : '1px solid #1e1e2e',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              userSelect: 'none',
            }}
          >
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%',
              border: selected === opt.id ? '5px solid #6366f1' : '2px solid #333',
              flexShrink: 0, transition: 'all 0.15s ease',
            }} />
            <input type="radio" name="vote" value={opt.id} checked={selected === opt.id}
              onChange={() => setSelected(opt.id)} style={{ display: 'none' }} />
            <span style={{ color: selected === opt.id ? '#fff' : '#bbb', fontWeight: selected === opt.id ? 600 : 400 }}>
              {opt.text}
            </span>
          </label>
        ))}

        <div style={{ marginTop: '0.5rem' }}>
          <button onClick={submitVote} disabled={!selected || submitting} style={{ padding: '0.9rem' }}>
            {submitting ? 'Enviando...' : 'Confirmar voto →'}
          </button>
        </div>
      </div>
    </div>
  )
}

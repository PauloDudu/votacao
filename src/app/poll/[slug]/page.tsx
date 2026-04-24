'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import type { Poll, PollOption } from '@/types/poll'

export default function VotePage() {
  const { slug } = useParams<{ slug: string }>()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [options, setOptions] = useState<PollOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', color: '#555' }}>Carregando...</div>
  )

  if (!poll) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
      <p style={{ color: '#888' }}>Votação não encontrada.</p>
    </div>
  )

  if (!poll.is_open) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
      <h1 style={{ marginBottom: '0.5rem' }}>{poll.title}</h1>
      <p style={{ color: '#888' }}>Esta votação foi encerrada.</p>
    </div>
  )

  if (voted) return (
    <div className="card" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</p>
      <h1 style={{ marginBottom: '0.5rem' }}>{poll.title}</h1>
      <p style={{ color: '#6366f1', fontWeight: 600 }}>Voto registrado. Obrigado!</p>
    </div>
  )

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
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: selected === opt.id ? '5px solid #6366f1' : '2px solid #333',
              flexShrink: 0,
              transition: 'all 0.15s ease',
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

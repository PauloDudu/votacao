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

      if (!pollData) {
        setLoading(false)
        return
      }

      setPoll(pollData)

      const { data: opts } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollData.id)

      setOptions(opts || [])

      // Check if already voted (using localStorage)
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
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('voter_id', id)
    }
    return id
  }

  const submitVote = async () => {
    if (!selected || !poll) return
    setSubmitting(true)

    const voterId = getVoterId()

    const { error } = await supabase.from('votes').insert({
      option_id: selected,
      poll_id: poll.id,
      voter_id: voterId,
    })

    if (error) {
      alert('Erro ao votar. Talvez você já tenha votado.')
    } else {
      setVoted(true)
    }
    setSubmitting(false)
  }

  if (loading) return <div className="container"><p>Carregando...</p></div>
  if (!poll) return <div className="container"><p>Votação não encontrada.</p></div>
  if (!poll.is_open) return <div className="container"><p>Esta votação foi encerrada.</p></div>

  if (voted) {
    return (
      <div className="container">
        <h1>{poll.title}</h1>
        <p style={{ color: '#6366f1', marginTop: '1rem' }}>Seu voto foi registrado. Obrigado!</p>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>{poll.title}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        {options.map((opt) => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              background: selected === opt.id ? '#1e1b4b' : '#1a1a1a',
              borderRadius: '8px',
              border: selected === opt.id ? '1px solid #6366f1' : '1px solid #333',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="vote"
              value={opt.id}
              checked={selected === opt.id}
              onChange={() => setSelected(opt.id)}
            />
            {opt.text}
          </label>
        ))}

        <button onClick={submitVote} disabled={!selected || submitting}>
          {submitting ? 'Votando...' : 'Votar'}
        </button>
      </div>
    </div>
  )
}

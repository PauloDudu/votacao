'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', '', ''])
  const [loading, setLoading] = useState(false)

  const addOption = () => setOptions([...options, ''])

  const updateOption = (index: number, value: string) => {
    const updated = [...options]
    updated[index] = value
    setOptions(updated)
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
  }

  const createPoll = async () => {
    const validOptions = options.filter((o) => o.trim())
    if (!title.trim() || validOptions.length < 2) return

    setLoading(true)

    // Manter no máximo 5 votações: apagar as mais antigas se necessário
    const { data: existingPolls } = await supabase
      .from('polls')
      .select('id')
      .order('created_at', { ascending: true })

    if (existingPolls && existingPolls.length >= 5) {
      const toDelete = existingPolls.slice(0, existingPolls.length - 4)
      const idsToDelete = toDelete.map((p) => p.id)
      await supabase.from('polls').delete().in('id', idsToDelete)
    }

    const slug = nanoid(10)

    const { data: poll, error } = await supabase
      .from('polls')
      .insert({ title: title.trim(), slug, is_open: true })
      .select()
      .single()

    if (error || !poll) {
      alert('Erro ao criar votação')
      setLoading(false)
      return
    }

    const optionsData = validOptions.map((text) => ({
      poll_id: poll.id,
      text: text.trim(),
    }))

    await supabase.from('poll_options').insert(optionsData)

    router.push(`/poll/${slug}/results`)
  }

  return (
    <div className="card">
      <h1 style={{ color: '#6366f1' }}>Criar Votação</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          placeholder="Qual é a pergunta?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Título da votação"
          style={{ fontSize: '1rem', padding: '0.85rem 1rem' }}
        />

        <p style={{ color: '#555', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opções</p>

        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder={`Opção ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              aria-label={`Opção ${i + 1}`}
            />
            {options.length > 3 && (
              <button
                className="btn-danger"
                style={{ width: '44px', minWidth: '44px', padding: '0' }}
                onClick={() => removeOption(i)}
                aria-label={`Remover opção ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button className="btn-secondary" onClick={addOption} style={{ fontSize: '0.9rem' }}>
          + Adicionar opção
        </button>

        <button onClick={createPoll} disabled={loading} style={{ padding: '0.9rem' }}>
          {loading ? 'Criando...' : 'Criar Votação →'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', ''])
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
    <div className="container">
      <h1>Criar Votação</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          placeholder="Título da votação"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Título da votação"
        />

        <p style={{ color: '#888', fontSize: '0.9rem' }}>Opções:</p>

        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder={`Opção ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              aria-label={`Opção ${i + 1}`}
            />
            {options.length > 2 && (
              <button
                className="btn-danger"
                style={{ width: 'auto', padding: '0.75rem' }}
                onClick={() => removeOption(i)}
                aria-label={`Remover opção ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button className="btn-secondary" onClick={addOption}>
          + Adicionar opção
        </button>

        <button onClick={createPoll} disabled={loading}>
          {loading ? 'Criando...' : 'Criar Votação'}
        </button>
      </div>
    </div>
  )
}

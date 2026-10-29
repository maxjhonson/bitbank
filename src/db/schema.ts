export const SCHEMA_V1 = {
  jokes: 'id, status, *tags, updatedAt',
  performances: 'id, jokeId, date',
  sets: 'id, date, updatedAt',
  ideas: 'id, createdAt',
  settings: 'id',
} as const

export const SCHEMA_V2 = { ...SCHEMA_V1, chunks: 'id, updatedAt' } as const

export interface Collection {
  id: string
  name: string
  icon: string
  source: string
  description?: string
}

export interface DalilConfig {
  collections: Collection[]
}

export function defineConfig(config: DalilConfig): DalilConfig {
  return config
}

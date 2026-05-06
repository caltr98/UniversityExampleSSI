import 'reflect-metadata'

import {
  createAgent,
  ICredentialPlugin,
  IDataStore,
  IKeyManager,
  IResolver,
} from '@veramo/core'
import { IDIDManager } from '@veramo/core-types'
import { CredentialPlugin } from '@veramo/credential-w3c'
import {
  DataStore,
  DIDStore,
  Entities,
  IDataStoreORM,
  KeyStore,
  migrations,
  PrivateKeyStore,
} from '@veramo/data-store'
import { DIDManager } from '@veramo/did-manager'
import { EthrDIDProvider } from '@veramo/did-provider-ethr'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { KeyManager } from '@veramo/key-manager'
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'
import { Resolver } from 'did-resolver'
import { getResolver as getEthrResolver } from 'ethr-did-resolver'
import { DataSource } from 'typeorm'

export const SEPOLIA_DID_PROVIDER = 'did:ethr:sepolia'
export const ETHR_DID_REGISTRY = '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818'

export type VeramoAgent = IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  ICredentialPlugin

const DATABASE_FILE = process.env.VERAMO_DB_UNIVERSITY ?? 'database.sqlite'
// In the lecture slides this is generated with:
// export KMS_SECRET_KEY="$(npx @veramo/cli config create-secret-key)"
const KMS_SECRET_KEY =
  process.env.KMS_SECRET_KEY ??
  process.env.VERAMO_KMS_SECRET_KEY ??
  'f1baa0637294cbe40f68c8f2c16cc2a96982db8dde5a5a4b4f485f0ca2272069'

export const agent = createUniversityAgent()

export function createUniversityAgent() {
  const rpcUrl = getSepoliaRpcUrl()

  const dbConnection = new DataSource({
    type: 'sqlite',
    database: DATABASE_FILE,
    synchronize: false,
    migrations,
    migrationsRun: true,
    logging: ['error', 'info', 'warn'],
    entities: Entities,
  }).initialize()

  const ethrResolverAlchemy = getEthrResolver({
    networks: [
      {
        name: 'sepolia',
        rpcUrl,
        registry: ETHR_DID_REGISTRY,
      },
    ],
  })

  return createAgent<VeramoAgent>({
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: SEPOLIA_DID_PROVIDER,
        providers: {
          [SEPOLIA_DID_PROVIDER]: new EthrDIDProvider({
            defaultKms: 'local',
            network: 'sepolia',
            registry: ETHR_DID_REGISTRY,
            rpcUrl,
          }),
        },
      }),
      new DIDResolverPlugin({
        resolver: new Resolver(ethrResolverAlchemy),
      }),
      new CredentialPlugin(),
      new DataStore(dbConnection),
    ],
  })
}

function getSepoliaRpcUrl(): string {
  const explicitRpcUrl = process.env.SEPOLIA_RPC_URL ?? process.env.ALCHEMY_SEPOLIA_RPC_URL
  if (explicitRpcUrl) {
    return explicitRpcUrl
  }

  const alchemyApiKey = process.env.ALCHEMY_API_KEY
  if (alchemyApiKey) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`
  }

  throw new Error(
    'Missing Sepolia RPC configuration. Set SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY" before running this example.',
  )
}

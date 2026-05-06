import { inspect } from 'node:util'
import {
  CredentialPayload,
  IIdentifier,
  PresentationPayload,
  W3CVerifiableCredential,
  W3CVerifiablePresentation,
} from '@veramo/core-types'
import { agent, SEPOLIA_DID_PROVIDER } from './src/setup.js'

type JwtPayloadWithVp = {
  vp?: {
    verifiableCredential?: W3CVerifiableCredential[]
  }
}

async function getOrCreateDid(veramoAgent: typeof agent, alias: string): Promise<IIdentifier> {
  try {
    return await veramoAgent.didManagerGetByAlias({
      alias,
      provider: SEPOLIA_DID_PROVIDER,
    })
  } catch {
    return await veramoAgent.didManagerCreate({
      alias,
      provider: SEPOLIA_DID_PROVIDER,
      kms: 'local',
    })
  }
}

function printFull(label: string, value: unknown): void {
  console.log(`\n--- ${label} ---`)
  console.log(
    inspect(value, {
      depth: null,
      colors: true,
      compact: false,
      breakLength: 120,
      maxArrayLength: null,
      maxStringLength: null,
    }),
  )
}

function decodeJwt(jwt: string): unknown {
  const [, payload] = jwt.split('.')

  if (!payload) {
    throw new Error('Invalid JWT: missing payload')
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

function printFullCredentialOrPresentation(label: string, value: unknown): void {
  printFull(`${label} raw`, value)

  if (typeof value === 'string') {
    printFull(`${label} decoded JWT payload`, decodeJwt(value))
  }
}

function extractEmbeddedCredentials(vp: W3CVerifiablePresentation): W3CVerifiableCredential[] {
  if (typeof vp === 'string') {
    const decodedPayload = decodeJwt(vp) as JwtPayloadWithVp
    return decodedPayload.vp?.verifiableCredential ?? []
  }

  return vp.verifiableCredential ?? []
}

async function main(): Promise<void> {
  console.log('\nUniversity Degree VC demo with Veramo')
  console.log('Step by Step program')

  console.log('\nA. DIDs creation')
  const university = await getOrCreateDid(agent, 'university-of-pisa')
  const alice = await getOrCreateDid(agent, 'alice')
  const jobRecruiter = await getOrCreateDid(agent, 'job-recruiter')

  console.table([
    { actor: 'University of Pisa', role: 'Issuer', did: university.did },
    { actor: 'Alice', role: 'Holder / Subject', did: alice.did },
    { actor: 'Job Recruiter', role: 'Verifier', did: jobRecruiter.did },
  ])

  console.log('\nB. Payload: claims about Alice Degree')
  const degreeCredentialPayload: CredentialPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: { id: university.did },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: alice.did,
      fullName: 'Alice Rossi',
      birthDate: '2002-10-28',
      birthPlace: 'Lucca (LU), Italy',
      enrollmentDate: '2024-07-28',
      academicYear: '2024/2025',
      degreeName: 'Laurea Magistrale in Informatica',
      curriculum: 'ICT - ICT Solutions Architect',
      degreeClass: 'LM-18',
      normalDuration: '2 years',
      graduationDate: '2026-10-11',
      finalGrade: '110/110 e lode',
      diplomaIssueDate: '2026-10-11',
    },
  }

  printFull('Degree Credential Payload', degreeCredentialPayload)

  console.log('\nC. Issue VC: sign as JWT')
  const degreeVC: W3CVerifiableCredential = await agent.createVerifiableCredential({
    credential: degreeCredentialPayload,
    proofFormat: 'jwt',
  })

  printFullCredentialOrPresentation('Degree VC with JWT', degreeVC)

  console.log('\nD. Store VC: Alice stores Degree VC')
  const storedVcHash = await agent.dataStoreSaveVerifiableCredential({
    verifiableCredential: degreeVC,
  })

  printFull('Stored VC', {
    storedVcHash,
  })

  console.log('\nE. Create VP: Alice generates VP embedding the Degree VC')
  const degreePresentationPayload: PresentationPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiablePresentation'],
    holder: alice.did,
    verifiableCredential: [degreeVC],
  }

  printFull('Degree Presentation Payload', degreePresentationPayload)

  const degreeVP: W3CVerifiablePresentation = await agent.createVerifiablePresentation({
    presentation: degreePresentationPayload,
    proofFormat: 'jwt',
  })

  printFullCredentialOrPresentation('Degree VP with embedded VC', degreeVP)

  console.log('\nF. Verify VP: recruiter checks VP')
  const vpVerificationResult = await agent.verifyPresentation({
    presentation: degreeVP,
  })

  printFull('VP Verification result', vpVerificationResult)
  console.log('Verified:', vpVerificationResult.verified)

  console.log('\nG. Verify VC: recruiter checks every VC embedded in the VP')
  const embeddedCredentials = extractEmbeddedCredentials(degreeVP)

  printFull('Embedded Credentials extracted from VP', embeddedCredentials)

  for (const [index, embeddedCredential] of embeddedCredentials.entries()) {
    printFullCredentialOrPresentation(`Embedded VC ${index + 1}`, embeddedCredential)

    const vcVerificationResult = await agent.verifyCredential({
      credential: embeddedCredential,
    })

    printFull(`Embedded VC ${index + 1} verification result`, vcVerificationResult)
    console.log(`Embedded VC ${index + 1} verified:`, vcVerificationResult.verified)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})